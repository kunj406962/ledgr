"""
services/account.py
───────────────────
Business logic for accounts.

Key design decision — balance calculation:
    current_balance = opening_balance + SUM(transactions.amount)

Balance is NEVER stored as a column. It is always derived here at query time.
This prevents drift: if a transaction is edited or deleted, the balance
automatically corrects itself on the next fetch.

Positive amounts = money coming in (credits).
Negative amounts = money going out (debits).
"""

import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.account import Account
from models.transaction import Transaction  # imported for the balance SUM query
from schemas.account import AccountCreate, AccountUpdate, AccountResponse


def _compute_balance(db: Session, account: Account) -> Decimal:
    """
    Computes the current balance for a single account.

    Uses a single SUM() query rather than loading all transactions into memory.
    Returns opening_balance when no transactions exist yet.
    """
    total = (
        db.query(func.sum(Transaction.amount))
        .filter(Transaction.account_id == account.id)
        .scalar()
    )

    return account.opening_balance + (total or Decimal("0.00"))


def _to_response(db: Session, account: Account) -> AccountResponse:
    """
    Converts an Account ORM object to an AccountResponse,
    injecting the computed current_balance.
    """
    return AccountResponse(
        id=account.id,
        user_id=account.user_id,
        name=account.name,
        type=account.type,
        currency=account.currency,
        opening_balance=account.opening_balance,
        current_balance=_compute_balance(db, account),
        is_active=account.is_active,
        created_at=account.created_at,
    )


def get_accounts(db: Session, user_id: uuid.UUID) -> list[AccountResponse]:
    """
    Returns all active accounts for the given user,
    each with a computed current_balance.
    """
    accounts = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.is_active == True)
        .order_by(Account.created_at)
        .all()
    )
    return [_to_response(db, a) for a in accounts]


def get_account(
    db: Session, user_id: uuid.UUID, account_id: uuid.UUID
) -> AccountResponse:
    """
    Returns a single account by ID.
    Raises 404 if the account doesn't exist or doesn't belong to this user.
    """
    account = (
        db.query(Account)
        .filter(
            Account.id == account_id,
            Account.user_id == user_id,
            Account.is_active == True,
        )
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )

    return _to_response(db, account)


def create_account(
    db: Session, user_id: uuid.UUID, body: AccountCreate
) -> AccountResponse:
    """
    Creates a new account for the user.
    opening_balance should represent the real account balance on the
    day tracking begins — all future transactions build on top of it.
    """
    account = Account(
        user_id=user_id,
        name=body.name,
        type=body.type,
        currency=body.currency.upper(),
        opening_balance=body.opening_balance,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _to_response(db, account)


def update_account(
    db: Session,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    body: AccountUpdate,
) -> AccountResponse:
    """
    Updates mutable account fields (name, currency).
    opening_balance is intentionally not updatable after creation —
    changing it would silently shift the computed balance for all users.
    """
    account = (
        db.query(Account)
        .filter(
            Account.id == account_id,
            Account.user_id == user_id,
            Account.is_active == True,
        )
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )

    if body.name is not None:
        account.name = body.name
    if body.currency is not None:
        account.currency = body.currency.upper()

    db.commit()
    db.refresh(account)
    return _to_response(db, account)


def deactivate_account(db: Session, user_id: uuid.UUID, account_id: uuid.UUID) -> dict:
    """
    Soft-deletes an account by setting is_active = False.
    Transaction history is preserved — the account just stops appearing
    in the dashboard. This is intentional: hard-deleting an account would
    orphan or cascade-delete all its transactions, destroying history.
    """
    account = (
        db.query(Account)
        .filter(
            Account.id == account_id,
            Account.user_id == user_id,
            Account.is_active == True,
        )
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )

    account.is_active = False
    db.commit()
    return {"detail": "Account deactivated successfully"}

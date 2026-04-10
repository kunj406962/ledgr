"""
services/transaction.py
=======================
Business logic for Transaction CRUD.

Responsibilities:
- Compute `direction` from `amount` sign so routers never do this themselves.
- Compute `dedup_hash` (SHA-256 of account_id + date + amount + description) so
  the same transaction cannot be imported twice regardless of the import path
  (CSV, PDF, or manual entry with the same details).
- Enforce ownership: every read/write operation verifies the transaction belongs
  to an account owned by the requesting user. This is belt-and-suspenders on top
  of Supabase RLS.
- Provide both a per-account list (nested route) and a global filtered list.
- Handle soft deletes: transactions are never hard-deleted. `is_active = False`
  preserves audit history and keeps the balance calculation stable.

What this service does NOT do:
- Set `import_batch_id` — that is the responsibility of the import service (Phase 4).
- Set `transfer_id` — that is the responsibility of the transfer service below.
- Run Gemini classification — that is Phase 5.
"""

import hashlib
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.account import Account
from models.transaction import Transaction
from schemas.transaction import (
    DirectionEnum,
    TransactionCreate,
    TransactionUpdate,
)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _compute_dedup_hash(
    account_id: UUID,
    transaction_date,
    amount: Decimal,
    description_raw: Optional[str],
) -> str:
    """
    Compute a SHA-256 deduplication hash for a transaction row.

    The hash is derived from the four fields that uniquely identify a transaction
    from a bank statement: account, date, amount, and raw description. Two rows
    with the same hash are considered duplicates and the second insert will be
    rejected by the UNIQUE constraint on `transactions.dedup_hash`.

    For manual entries with no `description_raw`, we use an empty string so the
    hash is still deterministic. Manual duplicates (same account, date, amount,
    no description) will collide — this is intentional and surfaces user error.

    Args:
        account_id: UUID of the account this transaction belongs to.
        transaction_date: The date the transaction occurred.
        amount: The signed decimal amount.
        description_raw: Raw bank statement text, or None for manual entries.

    Returns:
        64-character hex string (SHA-256 digest).
    """
    raw = f"{account_id}|{transaction_date}|{amount}|{description_raw or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _derive_direction(amount: Decimal) -> DirectionEnum:
    """
    Derive the explicit direction enum from the amount sign.

    Direction is stored redundantly with the sign of `amount` so the frontend
    can use a simple string comparison instead of `amount < 0` checks.

    Args:
        amount: Signed decimal amount (positive = in, negative = out).

    Returns:
        DirectionEnum.IN or DirectionEnum.OUT.
    """
    return DirectionEnum.IN if amount > 0 else DirectionEnum.OUT


def _get_account_or_403(
    db: Session,
    account_id: UUID,
    user_id: UUID,
) -> Account:
    """
    Fetch an account and assert it belongs to the current user.

    Returns 404 if the account does not exist (or is soft-deleted).
    Returns 403 if it exists but belongs to a different user.

    Using 403 instead of 404 for ownership failures is intentional:
    returning 404 when the resource exists but is not yours leaks information
    (the account ID is valid). 403 is more honest.

    Args:
        db: Active SQLAlchemy session.
        account_id: UUID of the account to look up.
        user_id: UUID of the authenticated user.

    Returns:
        Account ORM object.

    Raises:
        HTTPException 404: Account not found or soft-deleted.
        HTTPException 403: Account exists but belongs to another user.
    """
    account = db.get(Account, account_id)
    if account is None or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account {account_id} not found.",
        )
    if account.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this account.",
        )
    return account


def _get_transaction_or_404(
    db: Session,
    transaction_id: UUID,
    account_id: UUID,
    user_id: UUID,
) -> Transaction:
    """
    Fetch a transaction and verify it belongs to the given account and user.

    Ownership is checked transitively: we verify the account belongs to the user,
    then verify the transaction belongs to that account.

    Args:
        db: Active SQLAlchemy session.
        transaction_id: UUID of the transaction to look up.
        account_id: UUID of the account this transaction should belong to.
        user_id: UUID of the authenticated user.

    Returns:
        Transaction ORM object.

    Raises:
        HTTPException 404: Transaction not found, soft-deleted, or wrong account.
        HTTPException 403: Account exists but belongs to another user.
    """
    # Verify the account is accessible first (raises 403/404 if not)
    _get_account_or_403(db, account_id, user_id)

    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.account_id == account_id,
            Transaction.is_active == True,  # noqa: E712 — SQLAlchemy needs ==
        )
    )
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found in account {account_id}.",
        )
    return transaction


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def list_transactions_for_account(
    db: Session,
    account_id: UUID,
    user_id: UUID,
    category: Optional[str] = None,
    from_date=None,
    to_date=None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Transaction], int]:
    """
    List transactions for a specific account with optional filters.

    Used by the nested route: GET /accounts/{account_id}/transactions

    Excludes soft-deleted transactions (`is_active = False`).
    Results are ordered by `transaction_date DESC` then `created_at DESC` so the
    most recent transactions appear first. Ties in date are broken by insert order.

    Args:
        db: Active SQLAlchemy session.
        account_id: The account to list transactions for.
        user_id: The authenticated user — account ownership is verified.
        category: Optional exact-match category filter.
        from_date: Optional inclusive start date filter.
        to_date: Optional inclusive end date filter.
        limit: Max rows to return (default 50, capped at 200 in the router).
        offset: Rows to skip for pagination.

    Returns:
        Tuple of (list of Transaction ORM objects, total count before pagination).

    Raises:
        HTTPException 403/404: If account is not accessible.
    """
    _get_account_or_403(db, account_id, user_id)

    base_query = select(Transaction).where(
        Transaction.account_id == account_id,
        Transaction.is_active == True,  # noqa: E712
    )

    if category:
        base_query = base_query.where(Transaction.category == category)
    if from_date:
        base_query = base_query.where(Transaction.transaction_date >= from_date)
    if to_date:
        base_query = base_query.where(Transaction.transaction_date <= to_date)

    # Total count for pagination metadata (runs before LIMIT/OFFSET)
    total = db.scalar(select(func.count()).select_from(base_query.subquery()))

    items = db.scalars(
        base_query.order_by(
            Transaction.transaction_date.desc(), Transaction.created_at.desc()
        )
        .limit(limit)
        .offset(offset)
    ).all()

    return list(items), total or 0


def list_transactions_global(
    db: Session,
    user_id: UUID,
    account_id: Optional[UUID] = None,
    category: Optional[str] = None,
    from_date=None,
    to_date=None,
    exclude_transfers: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Transaction], int]:
    """
    List transactions across all accounts owned by the user with optional filters.

    Used by the global route: GET /transactions

    The join to `accounts` ensures we only return rows from accounts that belong
    to the authenticated user — this is belt-and-suspenders alongside RLS.

    `exclude_transfers=True` strips transfer rows (those with a non-null `transfer_id`)
    from the results. Use this for spending analytics where transfers should not count
    as income or expenses.

    Args:
        db: Active SQLAlchemy session.
        user_id: The authenticated user.
        account_id: Optional — filter to a single account (must belong to user).
        category: Optional exact-match category filter.
        from_date: Optional inclusive start date filter.
        to_date: Optional inclusive end date filter.
        exclude_transfers: If True, omit transfer rows from results.
        limit: Max rows to return.
        offset: Rows to skip for pagination.

    Returns:
        Tuple of (list of Transaction ORM objects, total count before pagination).
    """
    base_query = (
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Account.user_id == user_id,
            Account.is_active == True,  # noqa: E712
            Transaction.is_active == True,  # noqa: E712
        )
    )

    if account_id:
        base_query = base_query.where(Transaction.account_id == account_id)
    if category:
        base_query = base_query.where(Transaction.category == category)
    if from_date:
        base_query = base_query.where(Transaction.transaction_date >= from_date)
    if to_date:
        base_query = base_query.where(Transaction.transaction_date <= to_date)
    if exclude_transfers:
        base_query = base_query.where(Transaction.transfer_id == None)  # noqa: E711

    total = db.scalar(select(func.count()).select_from(base_query.subquery()))

    items = db.scalars(
        base_query.order_by(
            Transaction.transaction_date.desc(), Transaction.created_at.desc()
        )
        .limit(limit)
        .offset(offset)
    ).all()

    return list(items), total or 0


def get_transaction(
    db: Session,
    transaction_id: UUID,
    account_id: UUID,
    user_id: UUID,
) -> Transaction:
    """
    Fetch a single transaction by ID.

    Args:
        db: Active SQLAlchemy session.
        transaction_id: UUID of the transaction.
        account_id: UUID of the account it should belong to.
        user_id: UUID of the authenticated user.

    Returns:
        Transaction ORM object.

    Raises:
        HTTPException 403/404: If not accessible.
    """
    return _get_transaction_or_404(db, transaction_id, account_id, user_id)


def create_transaction(
    db: Session,
    account_id: UUID,
    user_id: UUID,
    payload: TransactionCreate,
) -> Transaction:
    """
    Create a single manual transaction.

    Computes `direction` from the amount sign and `dedup_hash` server-side.
    If the dedup_hash already exists for this account, the DB unique constraint
    will raise an IntegrityError — the router catches this and returns 409.

    The `import_batch_id` and `transfer_id` are always None here. The import
    service (Phase 4) and transfer service set those fields directly.

    Args:
        db: Active SQLAlchemy session.
        account_id: UUID of the account to add the transaction to.
        user_id: UUID of the authenticated user (for ownership verification).
        payload: Validated TransactionCreate schema from the request body.

    Returns:
        Newly created Transaction ORM object.

    Raises:
        HTTPException 403/404: If account not accessible.
    """
    _get_account_or_403(db, account_id, user_id)

    dedup_hash = _compute_dedup_hash(
        account_id=account_id,
        transaction_date=payload.transaction_date,
        amount=payload.amount,
        description_raw=payload.description_raw,
    )
    direction = _derive_direction(payload.amount)

    transaction = Transaction(
        account_id=account_id,
        amount=payload.amount,
        direction=direction,
        category=payload.category,
        merchant=payload.merchant,
        description_raw=payload.description_raw,
        transaction_date=payload.transaction_date,
        is_recurring=payload.is_recurring,
        notes=payload.notes,
        dedup_hash=dedup_hash,
        # transfer_id and import_batch_id stay None for manual entries
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def update_transaction(
    db: Session,
    transaction_id: UUID,
    account_id: UUID,
    user_id: UUID,
    payload: TransactionUpdate,
) -> Transaction:
    """
    Partially update a transaction (PATCH semantics).

    Only the fields present in `payload` with non-None values are updated.
    `amount` is intentionally excluded from updates — see TransactionUpdate docstring
    for the design rationale.

    Args:
        db: Active SQLAlchemy session.
        transaction_id: UUID of the transaction to update.
        account_id: UUID of the account it belongs to.
        user_id: UUID of the authenticated user.
        payload: Validated TransactionUpdate schema.

    Returns:
        Updated Transaction ORM object.

    Raises:
        HTTPException 403/404: If not accessible.
    """
    transaction = _get_transaction_or_404(db, transaction_id, account_id, user_id)

    # Only update fields that were explicitly provided (not None)
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)

    db.commit()
    db.refresh(transaction)
    return transaction


def delete_transaction(
    db: Session,
    transaction_id: UUID,
    account_id: UUID,
    user_id: UUID,
) -> None:
    """
    Soft-delete a transaction by setting `is_active = False`.

    Hard deletes are never performed — the row must remain for the audit trail
    and to ensure the dedup_hash slot stays occupied (preventing re-import of
    the same row later).

    Effect on balance: since balance is computed as `opening_balance + SUM(amount)`
    and this query filters `WHERE is_active = True`, soft-deleting a transaction
    immediately removes it from the balance calculation with no extra work.

    Args:
        db: Active SQLAlchemy session.
        transaction_id: UUID of the transaction to soft-delete.
        account_id: UUID of the account it belongs to.
        user_id: UUID of the authenticated user.

    Raises:
        HTTPException 403/404: If not accessible.
    """
    transaction = _get_transaction_or_404(db, transaction_id, account_id, user_id)
    transaction.is_active = False
    db.commit()

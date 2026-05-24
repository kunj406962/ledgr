"""
services/transfer.py
====================
Business logic for creating cross-account transfers.

A transfer is a single logical money movement between two accounts owned by the
same user. It creates exactly two transaction rows atomically:
  - A debit row (amount < 0, direction = "out") on the source account
  - A credit row (amount > 0, direction = "in") on the destination account

Both rows share the same `transfer_id` UUID so they can be:
  1. Linked visually in the transaction list ("Transfer to Scotia Savings")
  2. Excluded from spending analytics (rows with transfer_id are not expenses or income)

Atomicity guarantee:
Both inserts and the transfer row itself are created within a single SQLAlchemy
session. If any insert fails (e.g. DB constraint violation), SQLAlchemy rolls back
the entire session — no half-written transfers are possible.

Ownership validation:
The service layer explicitly verifies that BOTH accounts belong to the requesting
user before creating anything. RLS provides a second layer of protection, but
returning a clear 403 from the service layer is better UX than a silent RLS block.
"""

import hashlib
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.account import Account
from models.transaction import Transaction
from models.transfer import Transfer
from schemas.transaction import DirectionEnum
from schemas.transfer import TransferCreate, TransferResponse

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_account_owned_by_user(
    db: Session,
    account_id: UUID,
    user_id: UUID,
    label: str,
) -> Account:
    """
    Fetch an account and assert ownership. Raises 404/403 with context-specific labels.

    `label` is used in the error message so the user knows which account failed:
    "source account" vs "destination account" is more useful than a bare UUID.

    Args:
        db: Active SQLAlchemy session.
        account_id: UUID of the account to look up.
        user_id: UUID of the authenticated user.
        label: Human-readable label for error messages ("source" or "destination").

    Returns:
        Account ORM object.

    Raises:
        HTTPException 404: Account not found or soft-deleted.
        HTTPException 403: Account belongs to another user.
    """
    account = db.get(Account, account_id)
    if account is None or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"The {label} account ({account_id}) was not found.",
        )
    if account.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have access to the {label} account.",
        )
    return account


def _compute_transfer_dedup_hash(
    account_id: UUID,
    transfer_date,
    amount: Decimal,
    transfer_id: UUID,
) -> str:
    """
    Compute a dedup hash for a transfer-generated transaction row.

    Transfer transactions use `transfer_id` as part of the hash instead of
    `description_raw` (which is always None for transfers). This guarantees
    uniqueness per transfer leg without colliding with manual entries that
    happen to have the same date and amount.

    Args:
        account_id: The account this transaction leg belongs to.
        transfer_date: The date of the transfer.
        amount: The signed amount for this leg.
        transfer_id: The UUID of the parent Transfer record.

    Returns:
        64-character hex SHA-256 digest.
    """
    raw = f"{account_id}|{transfer_date}|{amount}|transfer:{transfer_id}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Public service function
# ---------------------------------------------------------------------------


def create_transfer(
    db: Session,
    user_id: UUID,
    payload: TransferCreate,
) -> TransferResponse:
    """
    Create a transfer between two accounts atomically.

    Steps (all within one SQLAlchemy session):
    1. Validate ownership of both accounts.
    2. Generate a new UUID for the Transfer record.
    3. Insert the Transfer row.
    4. Insert the debit Transaction row on `from_account` (negative amount, "out").
    5. Insert the credit Transaction row on `to_account` (positive amount, "in").
    6. Commit — all three rows land together or none do.

    The two transaction rows both get `transfer_id` set to the Transfer UUID so they
    can be linked and excluded from analytics queries.

    Note on dedup_hash for transfer rows:
    Transfer transaction rows include the `transfer_id` in their hash instead of
    `description_raw`. This prevents two identical transfers (same date, same amount,
    same accounts) from colliding on the dedup constraint, while still ensuring the
    same transfer cannot be inserted twice.

    Args:
        db: Active SQLAlchemy session.
        user_id: UUID of the authenticated user.
        payload: Validated TransferCreate schema.

    Returns:
        TransferResponse with the Transfer record and both transaction IDs.

    Raises:
        HTTPException 403/404: If either account is not accessible.
        HTTPException 400: If from_account == to_account (caught in schema validator,
                           but defence-in-depth check is here too).
    """
    if payload.from_account_id == payload.to_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination accounts must be different.",
        )

    # Verify both accounts exist and belong to this user
    _get_account_owned_by_user(db, payload.from_account_id, user_id, "source")
    _get_account_owned_by_user(db, payload.to_account_id, user_id, "destination")

    # Generate the transfer UUID upfront so we can reference it in both transaction rows
    transfer_id = uuid4()

    # --- Create the Transfer record ---
    transfer = Transfer(
        id=transfer_id,
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=payload.amount,
        transfer_date=payload.transfer_date,
        notes=payload.notes,
    )
    db.add(transfer)

    # --- Create the debit transaction (money leaving the source account) ---
    debit_amount = -payload.amount  # negative = money out
    debit_tx = Transaction(
        account_id=payload.from_account_id,
        amount=debit_amount,
        direction=DirectionEnum.OUT,
        category="Transfer",
        merchant=None,
        description_raw=None,
        transaction_date=payload.transfer_date,
        is_recurring=False,
        transfer_id=transfer_id,
        dedup_hash=_compute_transfer_dedup_hash(
            payload.from_account_id,
            payload.transfer_date,
            debit_amount,
            transfer_id,
        ),
        notes=payload.notes,
    )
    db.add(debit_tx)

    # --- Create the credit transaction (money arriving at the destination account) ---
    credit_tx = Transaction(
        account_id=payload.to_account_id,
        amount=payload.amount,  # positive = money in
        direction=DirectionEnum.IN,
        category="Transfer",
        merchant=None,
        description_raw=None,
        transaction_date=payload.transfer_date,
        is_recurring=False,
        transfer_id=transfer_id,
        dedup_hash=_compute_transfer_dedup_hash(
            payload.to_account_id,
            payload.transfer_date,
            payload.amount,
            transfer_id,
        ),
        notes=payload.notes,
    )
    db.add(credit_tx)

    # Single commit — all three rows land atomically or none do
    db.commit()
    db.refresh(transfer)
    db.refresh(debit_tx)
    db.refresh(credit_tx)

    return TransferResponse(
        id=UUID(str(transfer.id)),
        from_account_id=UUID(str(transfer.from_account_id)),
        to_account_id=UUID(str(transfer.to_account_id)),
        amount=transfer.amount,
        transfer_date=transfer.transfer_date,
        notes=transfer.notes,
        created_at=transfer.created_at,
        debit_transaction_id=UUID(str(debit_tx.id)),
        credit_transaction_id=UUID(str(credit_tx.id)),
    )

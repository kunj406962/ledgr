"""
routers/transactions.py
=======================
Transaction endpoints. Thin router — all logic lives in services/transaction.py.

Route structure:
  Nested (per-account):
    GET    /accounts/{account_id}/transactions           → list for one account
    POST   /accounts/{account_id}/transactions           → create manual transaction
    GET    /accounts/{account_id}/transactions/{tx_id}  → get single transaction
    PATCH  /accounts/{account_id}/transactions/{tx_id}  → partial update
    DELETE /accounts/{account_id}/transactions/{tx_id}  → soft delete

  Global (cross-account, with filters):
    GET    /transactions                                 → list across all user accounts

Both routes are registered in main.py. The nested routes use APIRouter with
`prefix="/accounts"` and the global route uses `prefix="/transactions"`.

Pagination defaults:
  limit defaults to 50, max is 200. The 200 cap prevents accidental full-table
  scans through the API — the ML pipeline reads directly from the DB instead.

Duplicate handling:
  The dedup_hash unique constraint at the DB level will raise IntegrityError if a
  manual entry exactly matches an existing row. The router catches this and returns
  409 Conflict with a clear message.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db import get_db
from schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)
from services.auth import get_current_user_id
from services.transaction import (
    create_transaction,
    delete_transaction,
    get_transaction,
    list_transactions_for_account,
    list_transactions_global,
    update_transaction,
)

# Router for nested /accounts/{account_id}/transactions routes
account_transactions_router = APIRouter(
    prefix="/accounts",
    tags=["transactions"],
)

# Router for global /transactions routes
transactions_router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)


# ---------------------------------------------------------------------------
# Nested routes — /accounts/{account_id}/transactions/...
# ---------------------------------------------------------------------------


@account_transactions_router.get(
    "/{account_id}/transactions",
    response_model=TransactionListResponse,
    summary="List transactions for an account",
    description=(
        "Returns a paginated list of active transactions for the specified account. "
        "Supports filtering by category and date range. "
        "Results are ordered by transaction_date DESC."
    ),
)
def list_transactions_for_account_route(
    account_id: UUID,
    category: Optional[str] = Query(None, description="Filter by exact category name."),
    from_date: Optional[date] = Query(
        None, description="Include transactions on or after this date."
    ),
    to_date: Optional[date] = Query(
        None, description="Include transactions on or before this date."
    ),
    limit: int = Query(50, ge=1, le=200, description="Max results to return (1–200)."),
    offset: int = Query(
        0, ge=0, description="Number of results to skip for pagination."
    ),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    items, total = list_transactions_for_account(
        db=db,
        account_id=account_id,
        user_id=user_id,
        category=category,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    return TransactionListResponse(items=items, total=total, limit=limit, offset=offset)


@account_transactions_router.post(
    "/{account_id}/transactions",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a manual transaction",
    description=(
        "Create a single transaction via manual entry. "
        "`amount` must be non-zero: positive = money in, negative = money out. "
        "The server computes `direction` and `dedup_hash` automatically. "
        "Returns 409 if a transaction with the same account, date, amount, and "
        "description already exists."
    ),
)
def create_transaction_route(
    account_id: UUID,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        return create_transaction(
            db=db,
            account_id=account_id,
            user_id=user_id,
            payload=payload,
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A transaction with the same account, date, amount, and description "
                "already exists. If this is intentional, add a note to differentiate it."
            ),
        )


@account_transactions_router.get(
    "/{account_id}/transactions/{transaction_id}",
    response_model=TransactionResponse,
    summary="Get a single transaction",
)
def get_transaction_route(
    account_id: UUID,
    transaction_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return get_transaction(
        db=db,
        transaction_id=transaction_id,
        account_id=account_id,
        user_id=user_id,
    )


@account_transactions_router.patch(
    "/{account_id}/transactions/{transaction_id}",
    response_model=TransactionResponse,
    summary="Update a transaction",
    description=(
        "Partially update a transaction. Only send fields you want to change. "
        "`amount` cannot be changed after creation — soft-delete and re-create instead."
    ),
)
def update_transaction_route(
    account_id: UUID,
    transaction_id: UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return update_transaction(
        db=db,
        transaction_id=transaction_id,
        account_id=account_id,
        user_id=user_id,
        payload=payload,
    )


@account_transactions_router.delete(
    "/{account_id}/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a transaction",
    description=(
        "Marks the transaction as inactive (is_active = False). "
        "The row is preserved for audit history and deduplication. "
        "The transaction is immediately removed from the account balance calculation."
    ),
)
def delete_transaction_route(
    account_id: UUID,
    transaction_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    delete_transaction(
        db=db,
        transaction_id=transaction_id,
        account_id=account_id,
        user_id=user_id,
    )


# ---------------------------------------------------------------------------
# Global route — /transactions
# ---------------------------------------------------------------------------


@transactions_router.get(
    "",
    response_model=TransactionListResponse,
    summary="List transactions across all accounts",
    description=(
        "Returns a paginated list of transactions across all active accounts owned "
        "by the authenticated user. Supports filtering by account, category, date range, "
        "and excluding transfer rows. "
        "Use `exclude_transfers=true` for analytics — transfers are not income or expenses."
    ),
)
def list_transactions_global_route(
    account_id: Optional[UUID] = Query(
        None, description="Filter to a specific account."
    ),
    category: Optional[str] = Query(None, description="Filter by exact category name."),
    from_date: Optional[date] = Query(
        None, description="Include transactions on or after this date."
    ),
    to_date: Optional[date] = Query(
        None, description="Include transactions on or before this date."
    ),
    exclude_transfers: bool = Query(
        False,
        description="If true, exclude transfer rows. Use for spending analytics.",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    items, total = list_transactions_global(
        db=db,
        user_id=user_id,
        account_id=account_id,
        category=category,
        from_date=from_date,
        to_date=to_date,
        exclude_transfers=exclude_transfers,
        limit=limit,
        offset=offset,
    )
    return TransactionListResponse(items=items, total=total, limit=limit, offset=offset)

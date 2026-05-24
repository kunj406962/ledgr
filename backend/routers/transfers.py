"""
routers/transfers.py
====================
Transfer endpoint. Single route — all logic lives in services/transfer.py.

Route:
  POST /transfers → create a transfer between two accounts (atomic double-entry)

There is intentionally no GET /transfers list endpoint here in Phase 3.
Transfers are surfaced through the transaction list endpoints: both legs
appear in GET /accounts/{id}/transactions with `transfer_id` populated,
and GET /transactions includes them unless `exclude_transfers=true`.

A dedicated GET /transfers endpoint can be added in a later phase if the
frontend needs a transfer-specific view (e.g. a "Transfers" tab).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db import get_db
from schemas.transfer import TransferCreate, TransferResponse
from services.auth import get_current_user_id
from services.transfer import create_transfer

router = APIRouter(
    prefix="/transfers",
    tags=["transfers"],
)


@router.post(
    "",
    response_model=TransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a transfer between accounts",
    description=(
        "Moves money from one account to another atomically. "
        "Creates two linked transaction rows (one debit, one credit) in a single "
        "database transaction — both succeed or both are rolled back. "
        "Both accounts must belong to the authenticated user. "
        "Transfer rows are tagged with `transfer_id` and excluded from spending analytics "
        "when `exclude_transfers=true` is used on transaction list endpoints."
    ),
)
def create_transfer_route(
    payload: TransferCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return create_transfer(db=db, user_id=user_id, payload=payload)

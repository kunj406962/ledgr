"""
schemas/transfer.py
===================
Pydantic schemas for the Transfer resource.

Design decisions:
- A transfer is a single logical action that creates TWO transaction rows atomically.
  The client sends one `TransferCreate` payload; the service creates both rows in a
  single SQLAlchemy session (BEGIN/COMMIT). If either insert fails, both are rolled back.
- `amount` is always positive on the wire — it represents the magnitude of the movement.
  The service derives the sign: negative for the source account, positive for the destination.
- `transfer_date` defaults to today, same convention as TransactionCreate.
- The response includes both transaction IDs so the frontend can link to either leg
  of the transfer in the transaction list.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class TransferCreate(BaseModel):
    """
    Payload for POST /transfers.

    Both `from_account_id` and `to_account_id` must belong to the authenticated user —
    this is enforced in the service layer (not just via RLS) so we can return a clear
    403 rather than a silent 404 if an account is not found.

    `amount` must be positive. The service will write:
    - A negative amount row on `from_account_id` (direction = "out")
    - A positive amount row on `to_account_id`  (direction = "in")
    Both rows share the same `transfer_id` so they can be linked and excluded from
    spending analytics.
    """

    from_account_id: UUID = Field(..., description="Account money is leaving.")
    to_account_id: UUID = Field(..., description="Account money is arriving in.")
    amount: Decimal = Field(
        ...,
        gt=0,
        description="Amount to transfer. Must be positive. Direction is inferred by the service.",
    )
    transfer_date: date = Field(
        default_factory=date.today,
        description="Date the transfer occurred. Defaults to today.",
    )
    notes: Optional[str] = Field(
        None, description="Optional user note for the transfer."
    )

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Transfer amount must be positive")
        return v

    def model_post_init(self, __context) -> None:
        """Prevent transferring to the same account."""
        if self.from_account_id == self.to_account_id:
            raise ValueError(
                "from_account_id and to_account_id must be different accounts"
            )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TransferResponse(BaseModel):
    """
    Response for a completed transfer.

    Returns the transfer record plus the IDs of both transaction rows it created.
    The frontend can use `debit_transaction_id` and `credit_transaction_id` to
    deep-link to either leg in the transaction list.
    """

    id: UUID
    from_account_id: UUID
    to_account_id: UUID
    amount: Decimal
    transfer_date: date
    notes: Optional[str]
    created_at: datetime
    debit_transaction_id: UUID  # the "out" row on from_account
    credit_transaction_id: UUID  # the "in" row on to_account

    model_config = {"from_attributes": True}

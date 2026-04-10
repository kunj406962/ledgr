"""
schemas/transaction.py
======================
Pydantic schemas for the Transaction resource.

Design decisions:
- `amount` is always a signed Decimal on the wire: negative = money out, positive = money in.
  The `direction` field mirrors the sign explicitly so the frontend never has to infer it.
- `category` is a free-form string intentionally — it is not an enum so users can define
  custom categories without a migration. Gemini classification (Phase 5) will write into
  this same field.
- `description_raw` is write-once on import. Manual entries leave it None.
- `dedup_hash` is never accepted from the client — it is computed server-side in the service
  layer to prevent tampering.
- `import_batch_id` and `transfer_id` are read-only on responses; clients cannot set them
  directly through this router (they are set by the import router and transfer router
  respectively).
- Filters on the list endpoint are expressed as optional query params, not as a schema —
  FastAPI handles those directly in the router signature.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DirectionEnum(str, Enum):
    """
    Explicit direction alongside the amount sign.

    Both fields carry the same information redundantly by design:
    - `amount` sign is used for arithmetic (SUM, balance computation)
    - `direction` is used for display logic so the frontend never does `amount < 0`
    """

    IN = "in"
    OUT = "out"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class TransactionCreate(BaseModel):
    """
    Payload for POST /accounts/{account_id}/transactions (manual entry).

    Notes:
    - `amount` must be non-zero. Positive = credit, negative = debit.
      The service layer will derive `direction` from the sign automatically —
      clients do not need to send it, but may optionally include it for clarity.
    - `transaction_date` defaults to today if omitted, matching the common case
      of entering a transaction the same day it occurred.
    - `is_recurring` defaults to False. When True, the ML pipeline uses this
      transaction as a signal for Prophet forecasting.
    """

    amount: Decimal = Field(
        ...,
        description="Signed amount. Positive = money in, negative = money out. Must be non-zero.",
    )
    category: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Spending category e.g. Groceries, Rent, Salary. Free-form string.",
    )
    merchant: Optional[str] = Field(
        None,
        max_length=255,
        description="Cleaned merchant name. Optional for manual entries.",
    )
    description_raw: Optional[str] = Field(
        None,
        description="Original bank statement text. None for manual entries.",
    )
    transaction_date: date = Field(
        default_factory=date.today,
        description="Date the transaction occurred. Defaults to today.",
    )
    is_recurring: bool = Field(
        False,
        description="Flag as a recurring transaction. Used by the ML forecasting pipeline.",
    )
    notes: Optional[str] = Field(
        None,
        description="User-added free-text notes.",
    )

    @field_validator("amount")
    @classmethod
    def amount_must_be_nonzero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("amount must be non-zero")
        return v


class TransactionUpdate(BaseModel):
    """
    Payload for PATCH /accounts/{account_id}/transactions/{transaction_id}.

    All fields are optional — send only the fields you want to change.

    What cannot be changed after creation:
    - `account_id` — moving a transaction between accounts is not supported.
      Delete and re-create instead to keep the audit trail clean.
    - `amount` — changing the amount would silently alter the account balance.
      This is intentional: if an amount was wrong, soft-delete and re-enter.
    - `dedup_hash`, `import_batch_id`, `transfer_id` — system fields, never client-editable.

    Design note: restricting `amount` edits is a deliberate safety choice.
    In a finance app, silent balance changes from edits are harder to audit than
    a delete + new entry, which creates a clear paper trail.
    """

    category: Optional[str] = Field(None, min_length=1, max_length=100)
    merchant: Optional[str] = Field(None, max_length=255)
    transaction_date: Optional[date] = None
    is_recurring: Optional[bool] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TransactionResponse(BaseModel):
    """
    Response shape for a single transaction.

    Returned by: GET list, GET single, POST, PATCH.
    `transfer_id` being non-None signals this row is half of a transfer —
    the frontend should render it differently (e.g. no category badge, different icon).
    `import_batch_id` being non-None means it came from a CSV/PDF import.
    """

    id: UUID
    account_id: UUID
    amount: Decimal
    direction: DirectionEnum
    category: str
    merchant: Optional[str]
    description_raw: Optional[str]
    transaction_date: date
    is_recurring: bool
    transfer_id: Optional[UUID]
    import_batch_id: Optional[UUID]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    """
    Paginated list response for transaction list endpoints.

    `total` is the count before pagination so the frontend can render
    page controls without a second query.
    """

    items: list[TransactionResponse]
    total: int
    limit: int
    offset: int

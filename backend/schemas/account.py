"""
schemas/account.py
──────────────────
Pydantic schemas for account request validation and response serialization.

Separation of concerns:
- AccountCreate  → what the client sends when creating an account
- AccountUpdate  → what the client sends when editing an account (all fields optional)
- AccountResponse → what the API returns (includes computed current_balance)
"""

from decimal import Decimal
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from models.account import AccountType


class AccountCreate(BaseModel):
    """
    Body for POST /accounts.
    opening_balance should be set to the account's real balance
    on the day the user starts tracking it in the app.
    """

    name: str = Field(..., min_length=1, max_length=100, examples=["TD Chequing"])
    type: AccountType = Field(..., examples=["chequing"])
    currency: str = Field("CAD", min_length=3, max_length=3, examples=["CAD"])
    opening_balance: Decimal = Field(Decimal("0.00"), examples=[7640.22])


class AccountUpdate(BaseModel):
    """
    Body for PATCH /accounts/{id}.
    All fields are optional — only provided fields are updated.
    opening_balance is intentionally excluded: changing it after creation
    would silently shift all computed balances.
    """

    name: str | None = Field(None, min_length=1, max_length=100)
    currency: str | None = Field(None, min_length=3, max_length=3)


class AccountResponse(BaseModel):
    """
    Returned by GET /accounts and POST /accounts.
    current_balance is computed by the service layer — never stored in the DB.
    """

    id: UUID
    user_id: UUID
    name: str
    type: AccountType
    currency: str
    opening_balance: Decimal
    current_balance: Decimal  # computed field — opening_balance + SUM(transactions)
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

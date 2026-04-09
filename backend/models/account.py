"""
models/account.py
─────────────────
SQLAlchemy ORM model for the accounts table.

An account belongs to a user and holds an opening_balance.
Current balance is NEVER stored here — it is always derived at query time
by summing all transactions against this account:

    current_balance = opening_balance + SUM(transactions.amount)

This prevents balance drift when transactions are edited or deleted.
"""

import uuid
import enum
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db import Base


class AccountType(str, enum.Enum):
    """
    The three account types supported by the app.
    Investment accounts use Option A — cash flow tracking only,
    no live market prices (can be extended later with a holdings table).
    """

    chequing = "chequing"
    savings = "savings"
    investment = "investmen"


class Account(Base):
    __tablename__ = "accounts"

    # ── Primary key ───────────────────────────────────────────────────────────
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Unique account identifier",
    )

    # ── Foreign key ───────────────────────────────────────────────────────────
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="Owner of this account — references public.users",
    )

    # ── Core fields ───────────────────────────────────────────────────────────
    name = Column(
        String(100),
        nullable=False,
        comment="User-defined label e.g. 'TD Chequing', 'Scotia Savings'",
    )

    type = Column(
        Enum(AccountType),
        nullable=False,
        comment="chequing | savings | investment",
    )

    currency = Column(
        String(3),
        nullable=False,
        default="CAD",
        comment="ISO 4217 currency code — defaults to CAD",
    )

    opening_balance = Column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment=(
            "Balance before the first tracked transaction. "
            "Used as the base for computing current_balance. "
            "Never update this after initial creation."
        ),
    )

    # ── Soft delete ───────────────────────────────────────────────────────────
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment=(
            "Soft delete flag. Set to false to hide the account "
            "without losing transaction history. Never hard-delete accounts."
        ),
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="accounts")
    transactions = relationship(
        "Transaction",
        back_populates="account",
        cascade="all, delete-orphan",
    )
    import_batches = relationship(
        "ImportBatch",
        back_populates="account",
        cascade="all, delete-orphan",
    )

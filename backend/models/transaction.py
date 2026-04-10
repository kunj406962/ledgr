"""
models/transaction.py
─────────────────────
SQLAlchemy ORM model for the transactions table.

Design decisions:
- amount is signed: positive = money in, negative = money out
- direction enum is stored alongside amount as an explicit record
  (avoids ambiguity when amount is 0 or when querying by direction)
- balance is NEVER stored — always derived as:
      opening_balance + SUM(amount) WHERE account_id = ?
- dedup_hash prevents duplicate imports:
      SHA256(account_id + date + amount + description_raw)

This is a stub for Phase 3 (transaction entry).
The model is defined here now so the account service can reference
Transaction.amount in its balance SUM query without a circular import.
"""

import uuid
import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db import Base


class TransactionDirection(str, enum.Enum):
    """Explicit direction alongside the signed amount — avoids ambiguity."""

    incoming = "in"
    outgoing = "out"


class Transaction(Base):
    __tablename__ = "transactions"

    # ── Primary key ───────────────────────────────────────────────────────────
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Foreign keys ──────────────────────────────────────────────────────────
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        comment="Account this transaction belongs to",
    )

    # ── Core fields ───────────────────────────────────────────────────────────
    amount = Column(
        Numeric(12, 2),
        nullable=False,
        comment="Signed amount: positive = in, negative = out",
    )

    direction = Column(
        Enum(TransactionDirection),
        nullable=False,
        comment="Explicit in/out alongside the signed amount",
    )

    category = Column(
        String(100),
        nullable=False,
        comment="e.g. Groceries, Rent, Salary — set by user or Gemini",
    )

    merchant = Column(String(255), comment="Cleaned merchant name from Gemini")
    description_raw = Column(Text, comment="Original bank statement description")
    transaction_date = Column(Date, nullable=False)
    is_recurring = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # ── Import / transfer links ───────────────────────────────────────────────
    transfer_id = Column(UUID(as_uuid=True), ForeignKey("transfers.id"), nullable=True)
    import_batch_id = Column(
        UUID(as_uuid=True), ForeignKey("import_batches.id"), nullable=True
    )

    # ── Duplicate prevention ──────────────────────────────────────────────────
    dedup_hash = Column(
        String(64),
        unique=True,
        nullable=True,
        comment="SHA256(account_id+date+amount+description) — prevents duplicate imports",
    )

    notes = Column(Text)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    account = relationship("Account", back_populates="transactions")

    transfer = relationship(
        "Transfer",
        foreign_keys=[transfer_id],
        back_populates="transactions",
    )

    import_batch = relationship(
        "ImportBatch",
        back_populates="transactions",
    )

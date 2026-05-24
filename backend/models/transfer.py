"""
models/transfer.py
──────────────────
SQLAlchemy ORM model for the transfers table.

A transfer represents money moving between two accounts owned by the same user.
It is NOT an expense or income — it should be excluded from spending analytics.

Every transfer creates exactly two transaction rows:
    - one debit  (amount negative) on the source account
    - one credit (amount positive) on the destination account

Both transaction rows reference this transfer via transactions.transfer_id.
This link is what allows the app to identify and exclude transfers from
spending/income charts.

Atomicity guarantee:
    The transfer record and both transaction rows must be created inside
    a single SQLAlchemy session (BEGIN/COMMIT). If any insert fails,
    all three are rolled back. This is enforced in services/transfer.py.

Special SQLAlchemy note:
    Because two foreign keys (from_account_id, to_account_id) both point
    to the same accounts table, SQLAlchemy cannot automatically determine
    which FK maps to which relationship. The foreign_keys argument is
    required on both relationships to resolve the ambiguity.
"""

import uuid
from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db import Base


class Transfer(Base):
    __tablename__ = "transfers"

    # ── Primary key ───────────────────────────────────────────────────────────
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Unique transfer identifier — referenced by both linked transaction rows",
    )

    # ── Foreign keys ──────────────────────────────────────────────────────────
    from_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id"),
        nullable=False,
        comment="Account money is leaving — the debit side",
    )

    to_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id"),
        nullable=False,
        comment="Account money is entering — the credit side",
    )

    # ── Core fields ───────────────────────────────────────────────────────────
    amount = Column(
        Numeric(12, 2),
        nullable=False,
        comment="Amount transferred — always positive. Sign is applied per transaction row.",
    )

    transfer_date = Column(
        Date,
        nullable=False,
        comment="Date the transfer occurred",
    )

    notes = Column(
        Text,
        nullable=True,
        comment="Optional user note e.g. 'Monthly savings contribution'",
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    # foreign_keys is required here because both FKs point to the same table.
    # Without it SQLAlchemy raises an AmbiguousForeignKeysError.

    from_account = relationship(
        "Account",
        foreign_keys=[from_account_id],
    )

    to_account = relationship(
        "Account",
        foreign_keys=[to_account_id],
    )

    transactions = relationship(
        "Transaction",
        back_populates="transfer",
    )

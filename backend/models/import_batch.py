"""
models/import_batch.py
──────────────────────
SQLAlchemy ORM model for the import_batches table.

An import batch is created every time a user uploads a CSV or PDF bank statement.
It tracks the upload session and its status through the review workflow:

    pending   → file uploaded, transactions parsed, awaiting user review
    confirmed → user reviewed and approved the transactions
    cancelled → user rejected the import

Workflow:
    1. User uploads a CSV or PDF file
    2. Backend creates an ImportBatch with status='pending'
    3. Parser extracts transaction rows and returns them for review
    4. User edits any rows in the review table on the frontend
    5. User clicks Confirm → status becomes 'confirmed', transactions saved
       OR user clicks Cancel → status becomes 'cancelled', rows discarded

Each transaction created from an import stores the import_batch_id so you
can always trace which upload a transaction came from.
"""

import uuid
import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db import Base


class ImportStatus(str, enum.Enum):
    """Lifecycle states of an import batch."""

    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"


class ImportBatch(Base):
    __tablename__ = "import_batches"

    # ── Primary key ───────────────────────────────────────────────────────────
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Unique batch identifier",
    )

    # ── Foreign key ───────────────────────────────────────────────────────────
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        comment="The account this import targets",
    )

    # ── File info ─────────────────────────────────────────────────────────────
    filename = Column(
        String(255),
        nullable=False,
        comment="Original uploaded filename e.g. td_chequing_jan_2025.csv",
    )

    file_type = Column(
        String(3),
        nullable=False,
        comment="'csv' or 'pdf'",
    )

    # ── Status ────────────────────────────────────────────────────────────────
    status = Column(
        Enum(ImportStatus),
        nullable=False,
        default=ImportStatus.pending,
        comment="pending | confirmed | cancelled",
    )

    # ── Row counts ────────────────────────────────────────────────────────────
    row_count = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of transaction rows parsed from the file",
    )

    confirmed_count = Column(
        Integer,
        nullable=True,
        comment="How many rows the user approved — set on confirmation",
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the file was uploaded",
    )

    confirmed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the user confirmed or cancelled the batch",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    account = relationship(
        "Account",
        back_populates="import_batches",
    )

    transactions = relationship(
        "Transaction",
        back_populates="import_batch",
    )

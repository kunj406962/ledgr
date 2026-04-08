"""
models/user.py
──────────────
SQLAlchemy ORM model for the users table.

This table mirrors auth.users from Supabase Auth.
Rows are created automatically via the handle_new_user() DB trigger
whenever a user signs in with Google or GitHub for the first time.

The id column matches auth.users.id exactly — Supabase manages the UUID.
"""

from sqlalchemy import Column, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from db import Base


class User(Base):
    __tablename__ = "users"

    # ── Primary key ───────────────────────────────────────────────────────────
    # UUID comes from Supabase Auth — we never generate it ourselves.
    id = Column(UUID(as_uuid=True), primary_key=True)

    # ── Core fields ───────────────────────────────────────────────────────────
    email        = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(100), comment="Pulled from OAuth provider on first sign-in")
    avatar_url   = Column(Text, comment="Profile picture URL from Google or GitHub")
    home_currency = Column(
        String(3),
        nullable=False,
        default="CAD",
        comment="ISO 4217 code — used as the default currency for new accounts",
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    accounts = relationship(
        "Account",
        back_populates="user",
        cascade="all, delete-orphan",
    )
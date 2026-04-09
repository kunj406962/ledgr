"""
tests/conftest.py
─────────────────
Shared pytest fixtures used across all test files.

Uses an in-memory SQLite database so tests never touch the real
Supabase PostgreSQL instance. SQLAlchemy handles the dialect differences.

Fixtures:
    db       → a fresh SQLite session per test (rolls back after each test)
    client   → a FastAPI TestClient with auth dependency overridden
    mock_user → a fake User object representing the authenticated user
"""

import uuid
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db import Base, get_db
from main import app
from models.user import User
from models.account import Account
from models.transaction import Transaction
from services.auth import get_current_user

# ── In-memory SQLite DB ───────────────────────────────────────────────────────
# SQLite is used for tests — no external DB needed.
# check_same_thread=False is required for FastAPI's threaded test client.

SQLITE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    """Creates all tables before each test and drops them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Yields a fresh DB session for each test."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def mock_user(db) -> User:
    """
    Creates and returns a fake user in the test DB.
    Used to simulate an authenticated user across all tests.
    """
    user = User(
        id=uuid.uuid4(),
        email="test@ledgr.dev",
        display_name="Test User",
        avatar_url=None,
        home_currency="CAD",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def client(db, mock_user) -> TestClient:
    """
    FastAPI TestClient with two dependencies overridden:
        - get_db        → uses the test SQLite session
        - get_current_user → returns mock_user without any JWT verification
    This means no real tokens are needed in tests.
    """

    def override_get_db():
        try:
            yield db
        finally:
            pass

    def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def mock_account(db, mock_user) -> Account:
    """
    Creates and returns a fake chequing account in the test DB.
    Used by tests that need an existing account to work with.
    """
    account = Account(
        id=uuid.uuid4(),
        user_id=mock_user.id,
        name="TD Chequing",
        type="chequing",
        currency="CAD",
        opening_balance=Decimal("1000.00"),
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account

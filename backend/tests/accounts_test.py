"""
tests/test_accounts.py
──────────────────────
Tests for the accounts endpoints and balance calculation logic.

Covers:
    GET    /accounts          → list accounts
    POST   /accounts          → create account
    GET    /accounts/{id}     → get single account
    PATCH  /accounts/{id}     → update account
    DELETE /accounts/{id}     → soft delete

Balance calculation:
    current_balance = opening_balance + SUM(transactions.amount)
"""

import uuid
from decimal import Decimal
from datetime import date

from models.account import Account
from models.transaction import Transaction

# ── List accounts ─────────────────────────────────────────────────────────────


def test_list_accounts_empty(client):
    """GET /accounts with no accounts should return an empty list."""
    resp = client.get("/accounts")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_accounts_returns_own_only(client, mock_account):
    """GET /accounts should only return accounts belonging to the current user."""
    resp = client.get("/accounts")
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "TD Chequing"


# ── Create account ────────────────────────────────────────────────────────────


def test_create_account(client):
    """POST /accounts should create and return a new account."""
    resp = client.post(
        "/accounts",
        json={
            "name": "Scotia Savings",
            "type": "savings",
            "currency": "CAD",
            "opening_balance": 7640.22,
        },
    )
    assert resp.status_code == 201

    data = resp.json()
    assert data["name"] == "Scotia Savings"
    assert data["type"] == "savings"
    assert data["currency"] == "CAD"
    assert float(data["opening_balance"]) == 7640.22
    assert float(data["current_balance"]) == 7640.22  # no transactions yet
    assert data["is_active"] is True
    assert "id" in data


def test_create_account_currency_uppercased(client):
    """Currency should be stored as uppercase regardless of input."""
    resp = client.post(
        "/accounts",
        json={
            "name": "USD Account",
            "type": "chequing",
            "currency": "usd",
            "opening_balance": 0,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["currency"] == "USD"


def test_create_account_defaults(client):
    """opening_balance should default to 0 and currency to CAD."""
    resp = client.post(
        "/accounts",
        json={
            "name": "Wealthsimple TFSA",
            "type": "investment",
        },
    )
    assert resp.status_code == 201

    data = resp.json()
    assert float(data["opening_balance"]) == 0.00
    assert data["currency"] == "CAD"


def test_create_account_missing_name(client):
    """POST /accounts without a name should return 422."""
    resp = client.post("/accounts", json={"type": "chequing"})
    assert resp.status_code == 422


def test_create_account_invalid_type(client):
    """POST /accounts with an invalid type should return 422."""
    resp = client.post(
        "/accounts",
        json={
            "name": "Bad Account",
            "type": "crypto",  # not a valid AccountType
        },
    )
    assert resp.status_code == 422


# ── Get single account ────────────────────────────────────────────────────────


def test_get_account(client, mock_account):
    """GET /accounts/{id} should return the account."""
    resp = client.get(f"/accounts/{mock_account.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(mock_account.id)


def test_get_account_not_found(client):
    """GET /accounts/{id} with a non-existent ID should return 404."""
    resp = client.get(f"/accounts/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Update account ────────────────────────────────────────────────────────────


def test_update_account_name(client, mock_account):
    """PATCH /accounts/{id} should update the name."""
    resp = client.patch(f"/accounts/{mock_account.id}", json={"name": "TD Main"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "TD Main"


def test_update_account_currency(client, mock_account):
    """PATCH /accounts/{id} should update and uppercase the currency."""
    resp = client.patch(f"/accounts/{mock_account.id}", json={"currency": "usd"})
    assert resp.status_code == 200
    assert resp.json()["currency"] == "USD"


def test_update_account_not_found(client):
    """PATCH /accounts/{id} with a non-existent ID should return 404."""
    resp = client.patch(f"/accounts/{uuid.uuid4()}", json={"name": "Ghost"})
    assert resp.status_code == 404


# ── Deactivate account ────────────────────────────────────────────────────────


def test_deactivate_account(client, mock_account):
    """DELETE /accounts/{id} should soft-delete the account."""
    resp = client.delete(f"/accounts/{mock_account.id}")
    assert resp.status_code == 200

    # Should no longer appear in the list
    list_resp = client.get("/accounts")
    assert list_resp.json() == []


def test_deactivate_account_not_found(client):
    """DELETE /accounts/{id} with a non-existent ID should return 404."""
    resp = client.delete(f"/accounts/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Balance calculation ───────────────────────────────────────────────────────


def test_balance_with_no_transactions(client, mock_account):
    """
    current_balance should equal opening_balance when no transactions exist.
    mock_account has opening_balance = 1000.00
    """
    resp = client.get(f"/accounts/{mock_account.id}")
    assert float(resp.json()["current_balance"]) == 1000.00


def test_balance_with_transactions(client, mock_account, db):
    """
    current_balance = opening_balance + SUM(transactions.amount)
    opening_balance = 1000.00
    transactions: +500, -200 → SUM = 300
    expected: 1300.00
    """
    db.add(
        Transaction(
            account_id=mock_account.id,
            amount=Decimal("500.00"),
            direction="in",
            category="Income",
            transaction_date=date(2025, 1, 15),
        )
    )
    db.add(
        Transaction(
            account_id=mock_account.id,
            amount=Decimal("-200.00"),
            direction="out",
            category="Groceries",
            transaction_date=date(2025, 1, 20),
        )
    )
    db.commit()

    resp = client.get(f"/accounts/{mock_account.id}")
    assert float(resp.json()["current_balance"]) == 1300.00


def test_balance_reflects_after_debit(client, mock_account, db):
    """
    A negative transaction should reduce the balance below opening_balance.
    opening_balance = 1000.00, transaction: -1450 (rent)
    expected: -450.00
    """
    db.add(
        Transaction(
            account_id=mock_account.id,
            amount=Decimal("-1450.00"),
            direction="out",
            category="Housing",
            transaction_date=date(2025, 1, 1),
        )
    )
    db.commit()

    resp = client.get(f"/accounts/{mock_account.id}")
    assert float(resp.json()["current_balance"]) == -450.00

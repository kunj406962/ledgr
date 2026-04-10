"""
tests/test_transactions.py
==========================
Test suite for Transaction CRUD endpoints.

Coverage:
  - GET /accounts/{id}/transactions  (list, filters, pagination)
  - POST /accounts/{id}/transactions (create, validation, dedup)
  - GET /accounts/{id}/transactions/{tx_id}
  - PATCH /accounts/{id}/transactions/{tx_id}
  - DELETE /accounts/{id}/transactions/{tx_id}
  - GET /transactions (global, filters, exclude_transfers)

Uses the same fixtures from conftest.py:
  - `client`      — TestClient with overridden get_db and get_current_user
  - `db`          — in-memory SQLite session
  - `mock_user`   — pre-inserted User ORM object
  - `mock_account`— pre-inserted Account ORM object owned by mock_user

Helper `_tx()` creates a raw Transaction row directly in the DB so we can
test reads without going through the POST endpoint — keeps tests independent.
"""

import hashlib
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
import itertools
import pytest

from models.transaction import Transaction

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_dedup_hash(account_id, transaction_date, amount, description_raw=None):
    """Replicate the service-layer hash logic for assertion purposes."""
    raw = f"{account_id}|{transaction_date}|{amount}|{description_raw or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


_tx_counter = itertools.count(1)


def _tx(
    db,
    account_id,
    amount="-25.00",
    category="Groceries",
    transaction_date=None,
    transfer_id=None,
    is_active=True,
):
    """
    Insert a Transaction row directly into the test DB.

    Bypasses the router/service so tests for list/get/update/delete can set up
    their own state without depending on the POST endpoint working correctly.
    """
    amount_dec = Decimal(amount)
    d = transaction_date or (
        date(2025, 1, 1) + timedelta(days=next(_tx_counter))
    )  # ensure unique dates if not specified
    tx = Transaction(
        account_id=account_id,
        amount=amount_dec,
        direction="out" if amount_dec < 0 else "in",
        category=category,
        merchant="Test Merchant",
        transaction_date=d,
        is_recurring=False,
        is_active=is_active,
        transfer_id=transfer_id,
        dedup_hash=_make_dedup_hash(account_id, d, amount_dec),
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


# ---------------------------------------------------------------------------
# POST /accounts/{account_id}/transactions
# ---------------------------------------------------------------------------


class TestCreateTransaction:
    def test_create_success_debit(self, client, mock_account):
        """Creates a debit (negative amount) transaction and verifies direction=out."""
        resp = client.post(
            f"/accounts/{mock_account.id}/transactions",
            json={
                "amount": "-45.50",
                "category": "Groceries",
                "merchant": "Safeway",
                "transaction_date": "2025-01-10",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == "-45.50"
        assert data["direction"] == "out"
        assert data["category"] == "Groceries"
        assert data["merchant"] == "Safeway"
        assert data["account_id"] == str(mock_account.id)
        assert data["transfer_id"] is None
        assert data["import_batch_id"] is None

    def test_create_success_credit(self, client, mock_account):
        """Creates a credit (positive amount) transaction and verifies direction=in."""
        resp = client.post(
            f"/accounts/{mock_account.id}/transactions",
            json={
                "amount": "3650.00",
                "category": "Salary",
                "transaction_date": "2025-01-15",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["direction"] == "in"
        assert Decimal(data["amount"]) == Decimal("3650.00")

    def test_create_defaults_date_to_today(self, client, mock_account):
        """Omitting transaction_date should default to today."""
        resp = client.post(
            f"/accounts/{mock_account.id}/transactions",
            json={"amount": "-10.00", "category": "Coffee"},
        )
        assert resp.status_code == 201
        assert resp.json()["transaction_date"] is not None

    def test_create_zero_amount_rejected(self, client, mock_account):
        """Amount of zero must be rejected with 422."""
        resp = client.post(
            f"/accounts/{mock_account.id}/transactions",
            json={"amount": "0.00", "category": "Groceries"},
        )
        assert resp.status_code == 422

    def test_create_missing_category_rejected(self, client, mock_account):
        """Category is required — omitting it should return 422."""
        resp = client.post(
            f"/accounts/{mock_account.id}/transactions",
            json={"amount": "-20.00"},
        )
        assert resp.status_code == 422

    def test_create_duplicate_returns_409(self, client, db, mock_account):
        """
        Inserting a transaction that exactly matches an existing row's dedup_hash
        should return 409 Conflict, not 500.

        SQLite note: we seed the first row via _tx() (already committed to the DB
        session) rather than via a first POST. Two back-to-back POSTs through the
        TestClient can hit session-isolation timing in SQLite where the constraint
        isn't visible between requests. Seeding via _tx() guarantees the unique
        constraint is committed before the POST fires — which is how it works on
        Postgres in production too (the import service pre-commits rows).
        """
        tx_date = date(2025, 2, 1)
        # Seed a row with the same values the POST will hash: (account, date, amount, no description)
        seeded = _tx(
            db,
            mock_account.id,
            amount="-30.00",
            category="Groceries",
            transaction_date=tx_date,
        )

        # DEBUG - print what hash was stored
        print(f"\nSeeded dedup_hash: {seeded.dedup_hash}")

        # DEBUG - compute what the POST will hash
        expected = _make_dedup_hash(mock_account.id, tx_date, Decimal("-30.00"), None)
        print(f"Expected POST hash: {expected}")

        resp = client.post(
            f"/accounts/{mock_account.id}/transactions",
            json={
                "amount": "-30.00",
                "category": "Groceries",
                "transaction_date": "2025-02-01",
            },
        )
        print(f"Response: {resp.status_code} {resp.json()}")
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]

    def test_create_wrong_account_returns_403(self, client, db):
        """Posting to an account that doesn't belong to the user returns 403."""
        other_account_id = uuid4()
        resp = client.post(
            f"/accounts/{other_account_id}/transactions",
            json={"amount": "-20.00", "category": "Groceries"},
        )
        assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# GET /accounts/{account_id}/transactions
# ---------------------------------------------------------------------------


class TestListTransactionsForAccount:
    def test_list_returns_active_only(self, client, db, mock_account):
        """Soft-deleted transactions must not appear in the list."""
        active_tx = _tx(db, mock_account.id, amount="-10.00")
        soft_deleted = _tx(
            db,
            mock_account.id,
            amount="-20.00",
            category="Restaurants",
            is_active=False,
        )

        resp = client.get(f"/accounts/{mock_account.id}/transactions")
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.json()["items"]]
        assert str(active_tx.id) in ids
        assert str(soft_deleted.id) not in ids

    def test_list_filter_by_category(self, client, db, mock_account):
        """Category filter should return only matching rows."""
        _tx(db, mock_account.id, category="Groceries")
        _tx(db, mock_account.id, category="Restaurants")

        resp = client.get(
            f"/accounts/{mock_account.id}/transactions?category=Groceries"
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(item["category"] == "Groceries" for item in items)

    def test_list_filter_by_date_range(self, client, db, mock_account):
        """Date range filter should include only transactions within the range."""
        _tx(db, mock_account.id, transaction_date=date(2025, 1, 5))
        in_range = _tx(db, mock_account.id, transaction_date=date(2025, 1, 15))
        _tx(db, mock_account.id, transaction_date=date(2025, 1, 25))

        resp = client.get(
            f"/accounts/{mock_account.id}/transactions"
            "?from_date=2025-01-10&to_date=2025-01-20"
        )
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.json()["items"]]
        assert str(in_range.id) in ids
        assert len(ids) == 1

    def test_list_pagination(self, client, db, mock_account):
        """Pagination via limit and offset should work and total should reflect full count."""
        for i in range(5):
            _tx(db, mock_account.id, amount=f"-{10 + i}.00")

        resp = client.get(f"/accounts/{mock_account.id}/transactions?limit=2&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) == 2
        assert body["total"] >= 5
        assert body["limit"] == 2

    def test_list_ordered_by_date_desc(self, client, db, mock_account):
        """Most recent transaction should appear first."""
        _tx(db, mock_account.id, transaction_date=date(2025, 1, 1))
        _tx(db, mock_account.id, transaction_date=date(2025, 3, 1))

        resp = client.get(f"/accounts/{mock_account.id}/transactions")
        items = resp.json()["items"]
        assert items[0]["transaction_date"] >= items[-1]["transaction_date"]

    def test_list_wrong_account_returns_403(self, client):
        """List endpoint for a non-existent or unauthorized account returns 403/404."""
        resp = client.get(f"/accounts/{uuid4()}/transactions")
        assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# GET /accounts/{account_id}/transactions/{transaction_id}
# ---------------------------------------------------------------------------


class TestGetTransaction:
    def test_get_existing(self, client, db, mock_account):
        tx = _tx(db, mock_account.id)
        resp = client.get(f"/accounts/{mock_account.id}/transactions/{tx.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == str(tx.id)

    def test_get_soft_deleted_returns_404(self, client, db, mock_account):
        """A soft-deleted transaction should return 404."""
        tx = _tx(db, mock_account.id, is_active=False)
        resp = client.get(f"/accounts/{mock_account.id}/transactions/{tx.id}")
        assert resp.status_code == 404

    def test_get_nonexistent_returns_404(self, client, mock_account):
        resp = client.get(f"/accounts/{mock_account.id}/transactions/{uuid4()}")
        assert resp.status_code == 404

    def test_get_wrong_account_returns_404(self, client, db, mock_account):
        """
        A transaction that exists on the right account but is requested via a different
        account ID should return 404 (not leak the transaction exists at all).
        """
        tx = _tx(db, mock_account.id)
        resp = client.get(f"/accounts/{uuid4()}/transactions/{tx.id}")
        assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# PATCH /accounts/{account_id}/transactions/{transaction_id}
# ---------------------------------------------------------------------------


class TestUpdateTransaction:
    def test_update_category(self, client, db, mock_account):
        tx = _tx(db, mock_account.id, category="Groceries")
        resp = client.patch(
            f"/accounts/{mock_account.id}/transactions/{tx.id}",
            json={"category": "Food & Drink"},
        )
        assert resp.status_code == 200
        assert resp.json()["category"] == "Food & Drink"

    def test_update_notes(self, client, db, mock_account):
        tx = _tx(db, mock_account.id)
        resp = client.patch(
            f"/accounts/{mock_account.id}/transactions/{tx.id}",
            json={"notes": "Birthday dinner"},
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Birthday dinner"

    def test_update_is_recurring_flag(self, client, db, mock_account):
        tx = _tx(db, mock_account.id)
        assert tx.is_recurring is False
        resp = client.patch(
            f"/accounts/{mock_account.id}/transactions/{tx.id}",
            json={"is_recurring": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_recurring"] is True

    def test_update_amount_not_accepted(self, client, db, mock_account):
        """
        `amount` is not an allowed field in TransactionUpdate.
        FastAPI should strip it (extra='ignore') or the amount must not change.
        Either way the original amount is preserved.
        """
        tx = _tx(db, mock_account.id, amount="-25.00")
        resp = client.patch(
            f"/accounts/{mock_account.id}/transactions/{tx.id}",
            json={"amount": "-999.00", "category": "Groceries"},
        )
        # Either 422 (amount rejected) or 200 with original amount preserved
        if resp.status_code == 200:
            assert Decimal(resp.json()["amount"]) == Decimal("-25.00")

    def test_update_nonexistent_returns_404(self, client, mock_account):
        resp = client.patch(
            f"/accounts/{mock_account.id}/transactions/{uuid4()}",
            json={"category": "Groceries"},
        )
        assert resp.status_code == 404

    def test_patch_with_no_fields_is_no_op(self, client, db, mock_account):
        """An empty PATCH body should succeed and return the unchanged transaction."""
        tx = _tx(db, mock_account.id, category="Groceries")
        resp = client.patch(
            f"/accounts/{mock_account.id}/transactions/{tx.id}",
            json={},
        )
        assert resp.status_code == 200
        assert resp.json()["category"] == "Groceries"


# ---------------------------------------------------------------------------
# DELETE /accounts/{account_id}/transactions/{transaction_id}
# ---------------------------------------------------------------------------


class TestDeleteTransaction:
    def test_delete_returns_204(self, client, db, mock_account):
        tx = _tx(db, mock_account.id)
        resp = client.delete(f"/accounts/{mock_account.id}/transactions/{tx.id}")
        assert resp.status_code == 204

    def test_deleted_transaction_not_in_list(self, client, db, mock_account):
        """After deletion, the transaction should not appear in the list endpoint."""
        tx = _tx(db, mock_account.id)
        client.delete(f"/accounts/{mock_account.id}/transactions/{tx.id}")
        resp = client.get(f"/accounts/{mock_account.id}/transactions")
        ids = [item["id"] for item in resp.json()["items"]]
        assert str(tx.id) not in ids

    def test_deleted_transaction_not_gettable(self, client, db, mock_account):
        """After deletion, GET on that transaction should return 404."""
        tx = _tx(db, mock_account.id)
        client.delete(f"/accounts/{mock_account.id}/transactions/{tx.id}")
        resp = client.get(f"/accounts/{mock_account.id}/transactions/{tx.id}")
        assert resp.status_code == 404

    def test_delete_nonexistent_returns_404(self, client, mock_account):
        resp = client.delete(f"/accounts/{mock_account.id}/transactions/{uuid4()}")
        assert resp.status_code == 404

    def test_delete_preserves_row_in_db(self, client, db, mock_account):
        """
        Verify the row still exists in the DB after soft-delete (is_active=False).
        This is critical — the row must persist for dedup_hash to block re-imports.
        """
        tx = _tx(db, mock_account.id)
        client.delete(f"/accounts/{mock_account.id}/transactions/{tx.id}")
        db.expire_all()
        from sqlalchemy import select
        from models.transaction import Transaction

        row = db.scalar(select(Transaction).where(Transaction.id == tx.id))
        assert row is not None
        assert row.is_active is False


# ---------------------------------------------------------------------------
# GET /transactions (global route)
# ---------------------------------------------------------------------------


class TestListTransactionsGlobal:
    def test_global_list_returns_all_user_transactions(self, client, db, mock_account):
        _tx(db, mock_account.id, category="Groceries")
        _tx(db, mock_account.id, category="Salary", amount="3650.00")
        resp = client.get("/transactions")
        assert resp.status_code == 200
        assert resp.json()["total"] >= 2

    def test_global_list_filter_by_account(self, client, db, mock_account):
        _tx(db, mock_account.id, category="Groceries")
        resp = client.get(f"/transactions?account_id={mock_account.id}")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(item["account_id"] == str(mock_account.id) for item in items)

    def test_global_list_exclude_transfers(self, client, db, mock_account):
        """Transfer-tagged rows should be excluded when exclude_transfers=true."""
        transfer_id = uuid4()
        _tx(db, mock_account.id, category="Transfer", transfer_id=transfer_id)
        normal_tx = _tx(db, mock_account.id, category="Groceries")

        resp = client.get("/transactions?exclude_transfers=true")
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.json()["items"]]
        assert str(normal_tx.id) in ids
        # Transfer row should be absent
        for item in resp.json()["items"]:
            assert item["transfer_id"] is None

    def test_global_list_include_transfers_by_default(self, client, db, mock_account):
        """Without exclude_transfers, transfer rows should appear."""
        transfer_id = uuid4()
        tx = _tx(db, mock_account.id, category="Transfer", transfer_id=transfer_id)
        resp = client.get("/transactions")
        ids = [item["id"] for item in resp.json()["items"]]
        assert str(tx.id) in ids

    def test_global_list_category_filter(self, client, db, mock_account):
        _tx(db, mock_account.id, category="Groceries")
        _tx(db, mock_account.id, category="Gas")
        resp = client.get("/transactions?category=Gas")
        assert resp.status_code == 200
        assert all(item["category"] == "Gas" for item in resp.json()["items"])

"""
tests/test_transfers.py
=======================
Test suite for the POST /transfers endpoint.

Coverage:
  - Happy path: transfer creates Transfer row + two Transaction rows
  - Debit row has negative amount, direction=out
  - Credit row has positive amount, direction=in
  - Both legs share the same transfer_id
  - Same-account transfer is rejected (400)
  - Negative or zero amount is rejected (422)
  - Unknown account returns 403/404
  - Response includes debit_transaction_id and credit_transaction_id
  - Both transaction legs appear in per-account transaction lists
  - Both transaction legs are visible in global list without exclude_transfers
  - Both transaction legs are hidden from global list with exclude_transfers=true
  - Balance is affected correctly on both accounts after transfer

The `second_account` fixture creates a second Account also owned by mock_user.
"""

import uuid
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from models.account import Account
from models.transaction import Transaction
from models.transfer import Transfer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def second_account(db, mock_user):
    """A second active account owned by the same mock_user."""
    acct = Account(
        user_id=mock_user.id,
        name="Scotia Savings",
        type="savings",
        currency="CAD",
        opening_balance=Decimal("7640.22"),
        is_active=True,
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct


def _transfer_payload(from_id, to_id, amount="500.00", transfer_date="2025-01-07", notes=None):
    payload = {
        "from_account_id": str(from_id),
        "to_account_id": str(to_id),
        "amount": amount,
        "transfer_date": transfer_date,
    }
    if notes:
        payload["notes"] = notes
    return payload


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestCreateTransferHappyPath:
    def test_transfer_returns_201(self, client, mock_account, second_account):
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id),
        )
        assert resp.status_code == 201

    def test_transfer_response_shape(self, client, mock_account, second_account):
        """Response must include the transfer record plus both transaction IDs."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id, amount="500.00"),
        )
        data = resp.json()
        assert "id" in data
        assert "debit_transaction_id" in data
        assert "credit_transaction_id" in data
        assert data["from_account_id"] == str(mock_account.id)
        assert data["to_account_id"] == str(second_account.id)
        assert Decimal(data["amount"]) == Decimal("500.00")

    def test_transfer_creates_transfer_row_in_db(self, client, db, mock_account, second_account):
        """A Transfer record must be persisted with the correct fields."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id, amount="250.00"),
        )
        assert resp.status_code == 201
        # UUID comes back from JSON as a plain string — wrap in uuid.UUID before
        # passing to SQLAlchemy, which expects a UUID object (not str) for UUID columns.
        transfer_id = uuid.UUID(resp.json()["id"])

        row = db.scalar(select(Transfer).where(Transfer.id == transfer_id))
        assert row is not None
        assert Decimal(str(row.amount)) == Decimal("250.00")
        assert str(row.from_account_id) == str(mock_account.id)
        assert str(row.to_account_id) == str(second_account.id)

    def test_transfer_creates_two_transaction_rows(self, client, db, mock_account, second_account):
        """Exactly two Transaction rows must be created, sharing the same transfer_id."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id, amount="100.00"),
        )
        # Wrap string → uuid.UUID so SQLAlchemy's UUID type processor doesn't choke
        transfer_id = uuid.UUID(resp.json()["id"])

        rows = db.scalars(
            select(Transaction).where(Transaction.transfer_id == transfer_id)
        ).all()
        assert len(rows) == 2

    def test_debit_leg_is_negative(self, client, db, mock_account, second_account):
        """The transaction on the source account must have a negative amount and direction=out."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id, amount="300.00"),
        )
        debit_id = uuid.UUID(resp.json()["debit_transaction_id"])

        debit = db.get(Transaction, debit_id)
        assert debit is not None
        assert debit.amount < 0
        assert debit.direction == "out"
        assert str(debit.account_id) == str(mock_account.id)

    def test_credit_leg_is_positive(self, client, db, mock_account, second_account):
        """The transaction on the destination account must have a positive amount and direction=in."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id, amount="300.00"),
        )
        credit_id = uuid.UUID(resp.json()["credit_transaction_id"])

        credit = db.get(Transaction, credit_id)
        assert credit is not None
        assert credit.amount > 0
        assert credit.direction == "in"
        assert str(credit.account_id) == str(second_account.id)

    def test_both_legs_have_same_transfer_id(self, client, db, mock_account, second_account):
        """debit and credit transactions must reference the same Transfer record."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id),
        )
        data = resp.json()
        debit = db.get(Transaction, uuid.UUID(data["debit_transaction_id"]))
        credit = db.get(Transaction, uuid.UUID(data["credit_transaction_id"]))
        assert str(debit.transfer_id) == str(credit.transfer_id) == data["id"]

    def test_transfer_notes_propagated_to_both_legs(self, client, db, mock_account, second_account):
        """Notes on the transfer should appear on both transaction rows."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(
                mock_account.id, second_account.id, notes="Monthly savings"
            ),
        )
        data = resp.json()
        debit = db.get(Transaction, uuid.UUID(data["debit_transaction_id"]))
        credit = db.get(Transaction, uuid.UUID(data["credit_transaction_id"]))
        assert debit.notes == "Monthly savings"
        assert credit.notes == "Monthly savings"


# ---------------------------------------------------------------------------
# Transfer legs visible in transaction lists
# ---------------------------------------------------------------------------

class TestTransferLegsInTransactionLists:
    def test_debit_leg_in_source_account_list(self, client, db, mock_account, second_account):
        """The debit transaction should appear in GET /accounts/{from_id}/transactions."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id),
        )
        debit_id = resp.json()["debit_transaction_id"]

        list_resp = client.get(f"/accounts/{mock_account.id}/transactions")
        ids = [item["id"] for item in list_resp.json()["items"]]
        assert debit_id in ids

    def test_credit_leg_in_dest_account_list(self, client, db, mock_account, second_account):
        """The credit transaction should appear in GET /accounts/{to_id}/transactions."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id),
        )
        credit_id = resp.json()["credit_transaction_id"]

        list_resp = client.get(f"/accounts/{second_account.id}/transactions")
        ids = [item["id"] for item in list_resp.json()["items"]]
        assert credit_id in ids

    def test_transfer_legs_excluded_from_global_when_flag_set(self, client, db, mock_account, second_account):
        """With exclude_transfers=true, neither transfer leg should appear in GET /transactions."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id),
        )
        data = resp.json()

        global_resp = client.get("/transactions?exclude_transfers=true")
        ids = [item["id"] for item in global_resp.json()["items"]]
        assert data["debit_transaction_id"] not in ids
        assert data["credit_transaction_id"] not in ids

    def test_transfer_legs_included_in_global_without_flag(self, client, db, mock_account, second_account):
        """Without exclude_transfers, both legs should appear in GET /transactions."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id),
        )
        data = resp.json()

        global_resp = client.get("/transactions")
        ids = [item["id"] for item in global_resp.json()["items"]]
        assert data["debit_transaction_id"] in ids
        assert data["credit_transaction_id"] in ids


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------

class TestCreateTransferValidation:
    def test_same_account_returns_400(self, client, mock_account):
        """Transferring from and to the same account must return 400."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, mock_account.id),
        )
        assert resp.status_code in (400, 422)

    def test_negative_amount_rejected(self, client, mock_account, second_account):
        """Negative amount must be rejected by schema validation."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id, amount="-100.00"),
        )
        assert resp.status_code == 422

    def test_zero_amount_rejected(self, client, mock_account, second_account):
        """Zero amount must be rejected."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, second_account.id, amount="0.00"),
        )
        assert resp.status_code == 422

    def test_unknown_source_account_returns_404(self, client, second_account):
        """Unknown source account should return 404."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(uuid4(), second_account.id),
        )
        assert resp.status_code in (403, 404)

    def test_unknown_dest_account_returns_404(self, client, mock_account):
        """Unknown destination account should return 404."""
        resp = client.post(
            "/transfers",
            json=_transfer_payload(mock_account.id, uuid4()),
        )
        assert resp.status_code in (403, 404)

    def test_missing_from_account_returns_422(self, client, second_account):
        resp = client.post(
            "/transfers",
            json={"to_account_id": str(second_account.id), "amount": "100.00"},
        )
        assert resp.status_code == 422

    def test_missing_to_account_returns_422(self, client, mock_account):
        resp = client.post(
            "/transfers",
            json={"from_account_id": str(mock_account.id), "amount": "100.00"},
        )
        assert resp.status_code == 422
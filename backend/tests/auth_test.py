"""
tests/test_auth.py
──────────────────
Tests for the auth endpoints.

GET  /auth/me       → returns user profile
PATCH /auth/me      → updates display_name and home_currency
GET  /auth/session  → returns authenticated: true

All tests use the mock_user and client fixtures from conftest.py.
No real JWT tokens are needed — auth is bypassed via dependency override.
"""


def test_health(client):
    """Health endpoint should always return 200."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_get_me(client, mock_user):
    """GET /auth/me should return the current user's profile."""
    resp = client.get("/auth/me")
    assert resp.status_code == 200

    data = resp.json()
    assert data["email"] == mock_user.email
    assert data["display_name"] == mock_user.display_name
    assert data["home_currency"] == "CAD"
    assert "id" in data


def test_get_me_unauthenticated():
    """GET /auth/me without a token should return 401."""
    from fastapi.testclient import TestClient
    from main import app

    # Fresh client with no dependency overrides — no auth bypass
    with TestClient(app) as c:
        resp = c.get("/auth/me")
    assert resp.status_code == 401


def test_update_display_name(client, mock_user, db):
    """PATCH /auth/me should update display_name."""
    resp = client.patch("/auth/me", json={"display_name": "Jordan"})
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Jordan"

    # Verify it was actually saved in the DB
    db.refresh(mock_user)
    assert mock_user.display_name == "Jordan"


def test_update_home_currency(client, mock_user, db):
    """PATCH /auth/me should uppercase and save home_currency."""
    resp = client.patch("/auth/me", json={"home_currency": "usd"})
    assert resp.status_code == 200
    assert resp.json()["home_currency"] == "USD"

    db.refresh(mock_user)
    assert mock_user.home_currency == "USD"


def test_update_partial(client, mock_user):
    """PATCH /auth/me with only one field should not overwrite the other."""
    resp = client.patch("/auth/me", json={"display_name": "New Name"})
    assert resp.status_code == 200

    data = resp.json()
    assert data["display_name"] == "New Name"
    assert data["home_currency"] == "CAD"  # unchanged


def test_session(client, mock_user):
    """GET /auth/session should return authenticated: true with the user ID."""
    resp = client.get("/auth/session")
    assert resp.status_code == 200

    data = resp.json()
    assert data["authenticated"] is True
    assert data["user_id"] == str(mock_user.id)

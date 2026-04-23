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


"""
tests/test_auth_delete.py
─────────────────────────
Tests for DELETE /auth/me — permanent account deletion.

DELETE /auth/me → hard-deletes the user from public.users, then calls
                  the Supabase Admin API to remove from auth.users.

All tests use the mock_user and client fixtures from conftest.py.
No real JWT tokens are needed — auth is bypassed via dependency override.
The Supabase Admin API call is mocked with unittest.mock so no network
requests are made.
"""

from unittest.mock import AsyncMock, patch
import httpx


def test_delete_me_returns_204(client, mock_user):
    """DELETE /auth/me should return 204 No Content with an empty body."""
    with patch("routers.auth.httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.delete = AsyncMock(return_value=httpx.Response(204))
        mock_cls.return_value = mock_http

        resp = client.delete("/auth/me")

    assert resp.status_code == 204
    assert resp.content == b""


def test_delete_me_removes_user_from_db(client, mock_user, db):
    """After DELETE /auth/me, the user row must not exist in public.users."""
    from models.user import User

    with patch("routers.auth.httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.delete = AsyncMock(return_value=httpx.Response(204))
        mock_cls.return_value = mock_http

        client.delete("/auth/me")

    remaining = db.query(User).filter(User.id == mock_user.id).first()
    assert remaining is None


def test_delete_me_user_is_gone_from_db(client, mock_user, db):
    """After DELETE /auth/me, the DB row is hard-deleted — confirmed by a direct query."""
    from models.user import User

    with patch("routers.auth.httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.delete = AsyncMock(return_value=httpx.Response(204))
        mock_cls.return_value = mock_http

        client.delete("/auth/me")

    remaining = db.query(User).filter(User.id == mock_user.id).first()
    assert remaining is None


def test_delete_me_calls_supabase_admin_api_with_correct_user_id(client, mock_user):
    """The Supabase Admin API call must include the correct user UUID in the URL."""
    with patch("routers.auth.httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_delete = AsyncMock(return_value=httpx.Response(204))
        mock_http.delete = mock_delete
        mock_cls.return_value = mock_http

        client.delete("/auth/me")

    called_url = mock_delete.call_args[0][0]
    assert str(mock_user.id) in called_url


def test_delete_me_uses_service_role_key_not_anon_key(client, mock_user):
    """The Supabase Admin API call must use the service role key, never the anon key."""
    with patch("routers.auth.httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_delete = AsyncMock(return_value=httpx.Response(204))
        mock_http.delete = mock_delete
        mock_cls.return_value = mock_http

        client.delete("/auth/me")

    _, kwargs = mock_delete.call_args
    headers_sent = kwargs.get("headers", {})
    assert "apikey" in headers_sent
    assert headers_sent["apikey"] != ""
    assert "Authorization" in headers_sent
    assert headers_sent["Authorization"].startswith("Bearer ")


def test_delete_me_unauthenticated():
    """DELETE /auth/me with no token should return 401 before touching the DB."""
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        resp = c.delete("/auth/me")
    assert resp.status_code == 401


def test_delete_me_malformed_token():
    """A garbage token should return 401, not 500."""
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        resp = c.delete(
            "/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
        )
    assert resp.status_code == 401


def test_delete_me_supabase_admin_failure_returns_502(client, mock_user):
    """If the Supabase Admin API returns non-2xx, the endpoint should return 502."""
    with patch("routers.auth.httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.delete = AsyncMock(
            return_value=httpx.Response(500, json={"message": "internal error"})
        )
        mock_cls.return_value = mock_http

        resp = client.delete("/auth/me")

    assert resp.status_code == 502
    assert "Supabase Auth removal failed" in resp.json()["detail"]


def test_delete_me_502_detail_mentions_support(client, mock_user):
    """The 502 error message should tell the user to contact support."""
    with patch("routers.auth.httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.delete = AsyncMock(return_value=httpx.Response(403))
        mock_cls.return_value = mock_http

        resp = client.delete("/auth/me")

    assert "support" in resp.json()["detail"].lower()

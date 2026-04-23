import uuid
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from models.user import User

bearer_scheme = HTTPBearer()

_JWKS_URL = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        response = httpx.get(_JWKS_URL)
        response.raise_for_status()
        _jwks_cache = response.json()
    return _jwks_cache


def _decode_supabase_token(token: str) -> dict:
    try:
        jwks = _get_jwks()
        return jwt.decode(
            token,
            jwks,
            algorithms=["ES256", "RS256", "HS256"],  # accept all supabase variants
            options={"verify_aud": False},
        )
    except JWTError as e:
        print(f"JWT ERROR: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = _decode_supabase_token(credentials.credentials)

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    user = db.query(User).filter(User.id == uuid.UUID(user_id_str)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Try signing in again.",
        )
    return user


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> uuid.UUID:
    payload = _decode_supabase_token(credentials.credentials)
    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
    return uuid.UUID(user_id_str)


def delete_current_user(db: Session, user_id: uuid.UUID) -> None:
    """
    Hard-delete the user row from public.users.

    Supabase Auth's own record (auth.users) must be removed separately
    via the Supabase Admin API using the service role key — we cannot
    DELETE from auth.users directly through SQLAlchemy.

    Cascade behaviour depends on your FK constraints. Accounts use
    soft-delete (is_active = False) so their history is preserved in
    the DB even after the user row is gone — adjust if you want a full
    hard-delete cascade instead.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()

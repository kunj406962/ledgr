"""
services/auth.py
────────────────
All JWT verification and user-lookup logic lives here.
Import get_current_user into any router that needs authentication.

Usage in any router:
    from services.auth import get_current_user

    @router.get("/something")
    def my_route(current_user: User = Depends(get_current_user)):
        ...
"""

import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from models.user import User

bearer_scheme = HTTPBearer()


def _decode_supabase_token(token: str) -> dict:
    """
    Decodes and validates a Supabase-issued JWT using our JWT secret.
    No network call — purely local verification.
    Raises 401 if the token is invalid or expired.
    """
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — decodes the Bearer token and returns the User ORM object.
    Use this whenever you need the full user row from the database.
    """
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
    """
    Lighter dependency — only decodes the token and returns the UUID.
    Use this when you need the user ID but don't need a DB lookup
    (e.g. when you're filtering by user_id in a query yourself).
    """
    payload = _decode_supabase_token(credentials.credentials)
    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
    return uuid.UUID(user_id_str)
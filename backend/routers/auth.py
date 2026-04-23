import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import httpx
from db import get_db
from models.user import User
from schemas.user import UserProfile, UpdateProfileRequest
from services.auth import get_current_user, get_current_user_id, delete_current_user
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the current user's profile."""
    return current_user


@router.patch("/me", response_model=UserProfile)
def update_me(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update display_name or home_currency."""
    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.home_currency is not None:
        current_user.home_currency = body.home_currency.upper()
    db.commit()

    db.refresh(current_user)
    return current_user


@router.get("/session")
def check_session(current_user: User = Depends(get_current_user)):
    """Lightweight token check — 200 if valid, 401 if not."""
    return {"authenticated": True, "user_id": str(current_user.id)}


@router.delete("/me", status_code=204)
async def delete_my_account(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Permanently delete the authenticated user's account.

    Step 1 — remove from public.users (cascades to accounts etc. per FK rules).
    Step 2 — remove from Supabase auth.users via Admin API (requires service role key).
    Returns 204 on success. Frontend should sign the user out immediately after.
    """
    # Step 1: delete from our public.users table
    delete_current_user(db, user_id)

    # Step 2: delete from Supabase Auth so the user can't log back in
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
        )
    if resp.status_code not in (200, 204):
        # Auth record removal failed — surface the error, don't silently continue
        raise HTTPException(
            status_code=502,
            detail="User data deleted but Supabase Auth removal failed. Contact support.",
        )

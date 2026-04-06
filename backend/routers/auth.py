from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models.user import User
from schemas.user import UserProfile, UpdateProfileRequest
from services.auth import get_current_user

router= APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the current user's profile."""
    return current_user

@router.patch("/me", response_model=UserProfile)
def update_me(
    body: UpdateProfileRequest,
    current_user: User= Depends(get_current_user),
    db: Session= Depends(get_db)
):
    """Update display_name or home_currency."""
    if body.display_name is not None:
        current_user.display_name= body.display_name
    if body.home_currency is not None:
        current_user.home_currency= body.home_currency
    db.commit()
    
    db.refresh(current_user)
    return current_user

@router.get("/session")
def check_session(current_user: User= Depends(get_current_user)):
    """Lightweight token check — 200 if valid, 401 if not."""
    return {"authenticated": True, "user_id": str(current_user.id)}
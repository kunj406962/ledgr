"""
routers/accounts.py
───────────────────
REST endpoints for account management.

All business logic lives in services/account.py — these routes
are intentionally thin: validate input, call the service, return the result.

Endpoints:
    GET    /accounts          → list all accounts for the current user
    POST   /accounts          → create a new account
    GET    /accounts/{id}     → get a single account by ID
    PATCH  /accounts/{id}     → update account name or currency
    DELETE /accounts/{id}     → soft-delete (deactivate) an account
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models.user import User
from schemas.account import AccountCreate, AccountUpdate, AccountResponse
from services.auth import get_current_user
from services import account as account_service

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
def list_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all active accounts for the authenticated user.
    Each account includes a computed current_balance field.
    """
    return account_service.get_accounts(db, current_user.id)


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(
    body: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new account.
    Set opening_balance to the real account balance on the day you
    start tracking — transactions will build on top of this value.
    """
    return account_service.create_account(db, current_user.id, body)


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a single account by ID.
    Returns 404 if the account doesn't exist or belongs to another user.
    """
    return account_service.get_account(db, current_user.id, account_id)


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: uuid.UUID,
    body: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates mutable fields on an account (name, currency).
    opening_balance cannot be changed after creation.
    """
    return account_service.update_account(db, current_user.id, account_id, body)


@router.delete("/{account_id}")
def deactivate_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft-deletes an account — sets is_active = False.
    Transaction history is fully preserved.
    The account will no longer appear in GET /accounts.
    """
    return account_service.deactivate_account(db, current_user.id, account_id)
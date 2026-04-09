"""
main.py
───────
FastAPI application entry point.

Routers are registered here as each phase is completed.
Currently active:
    - /auth      → user authentication and profile
    - /accounts  → account management

To run locally:
    uvicorn main:app --reload --port 8000

API docs (development only):
    http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import auth, accounts
import os

app = FastAPI(
    title="Ledgr API", description="Personal finance app backend setup", version="1.0.0"
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# In development, allow the Next.js dev server.
# In production, lock it down to your actual frontend domain.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url] if settings.is_production else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(accounts.router)


@app.get("/")
def root():
    return {"message": "Welcome to the Ledgr API!"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


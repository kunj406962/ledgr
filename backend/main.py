"""
main.py
───────
FastAPI application entry point.
 
To run locally:
    uvicorn main:app --reload --port 8000
 
Interactive API docs available at:
    http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import auth

app = FastAPI(
    title="Ledgr API",
    description="Personal finance app backend setup",
    version="1.0.0"
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

@app.get("/health")
def health_check():
    return {"status": "ok"}
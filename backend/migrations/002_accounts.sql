-- ============================================================
-- Ledgr — Migration 002: Accounts Table
-- Run this in your Supabase SQL Editor after 001_users_only.sql
-- ============================================================

-- ── Enum ─────────────────────────────────────────────────────────────────────

CREATE TYPE account_type AS ENUM ('chequing', 'savings', 'investment', 'credit_card');

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    type            account_type NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'CAD',
    opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Users can only see and modify their own accounts.

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_all_own" ON public.accounts
    FOR ALL USING (auth.uid() = user_id);
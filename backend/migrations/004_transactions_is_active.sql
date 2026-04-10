-- ============================================================
-- Ledgr — Migration 004: Add is_active to transactions
-- Run this in your Supabase SQL Editor after 003_transactions.sql
-- ============================================================

-- ── Why is_active? ────────────────────────────────────────────────────────────
-- The Phase 3 service layer uses soft deletes instead of hard deletes.
-- Reasons:
--   1. A deleted transaction must stay in the DB so its dedup_hash slot remains
--      occupied — otherwise the same row could be re-imported from a CSV/PDF.
--   2. Balance is derived as opening_balance + SUM(amount WHERE is_active = TRUE),
--      so soft-deleting a transaction immediately corrects the balance without
--      any extra work.
--   3. Audit trail — the full history of all entries is preserved.
--
-- is_active defaults to TRUE so all existing rows are unaffected.

ALTER TABLE public.transactions
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ── Performance indexes ───────────────────────────────────────────────────────
-- These complement the existing indexes from 003 and target the most common
-- query patterns introduced in Phase 3.

-- Covers the per-account list query (the nested route):
--   WHERE account_id = ? AND is_active = TRUE ORDER BY transaction_date DESC
CREATE INDEX idx_transactions_account_active_date
    ON public.transactions (account_id, is_active, transaction_date DESC);

-- Covers the soft-delete exclusion filter on the global route:
--   WHERE is_active = TRUE (partial index — only indexes active rows)
CREATE INDEX idx_transactions_active
    ON public.transactions (is_active)
    WHERE is_active = TRUE;

-- ── RLS note ──────────────────────────────────────────────────────────────────
-- The existing "transactions_all_own" RLS policy from 003 covers all operations
-- including the new is_active column updates. No RLS changes needed.
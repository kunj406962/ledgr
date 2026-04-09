-- ============================================================
-- Ledgr — Migration 003: Transactions & Transfers
-- Run this in your Supabase SQL Editor after 002_accounts.sql
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE transaction_direction AS ENUM ('in', 'out');
CREATE TYPE import_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- ── Transfers ─────────────────────────────────────────────────────────────────
-- Defined before transactions because transactions.transfer_id references it.
-- Every transfer creates exactly two transaction rows (one debit, one credit)
-- both pointing back to this record via transfer_id.

CREATE TABLE public.transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_account_id UUID NOT NULL REFERENCES public.accounts(id),
    to_account_id   UUID NOT NULL REFERENCES public.accounts(id),
    amount          DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    transfer_date   DATE NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Import Batches ────────────────────────────────────────────────────────────
-- Defined before transactions because transactions.import_batch_id references it.
-- Each CSV or PDF upload creates one batch. The user reviews and confirms it
-- before transactions are committed permanently.

CREATE TABLE public.import_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    file_type       CHAR(3) NOT NULL CHECK (file_type IN ('csv', 'pdf')),
    status          import_status NOT NULL DEFAULT 'pending',
    row_count       INTEGER NOT NULL DEFAULT 0,
    confirmed_count INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at    TIMESTAMPTZ
);

CREATE INDEX idx_import_batches_account_id ON public.import_batches(account_id);

-- ── Transactions ──────────────────────────────────────────────────────────────
-- Core table — every money movement is a row.
--
-- Key design decisions:
--   1. amount is signed: positive = in, negative = out
--   2. direction is stored explicitly alongside amount to avoid ambiguity
--   3. balance is NEVER stored here — always derived:
--          opening_balance + SUM(amount) WHERE account_id = ?
--   4. transfer_id links the two rows of a cross-account transfer.
--      Rows with a transfer_id are excluded from spending analytics.
--   5. dedup_hash prevents duplicate imports:
--          SHA256(account_id + date + amount + description_raw)

CREATE TABLE public.transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount           DECIMAL(12, 2) NOT NULL,
    direction        transaction_direction NOT NULL,
    category         VARCHAR(100) NOT NULL,
    merchant         VARCHAR(255),
    description_raw  TEXT,
    transaction_date DATE NOT NULL,
    is_recurring     BOOLEAN NOT NULL DEFAULT false,
    transfer_id      UUID REFERENCES public.transfers(id),
    import_batch_id  UUID REFERENCES public.import_batches(id),
    dedup_hash       VARCHAR(64),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevents the same transaction being imported twice for the same account
    UNIQUE (account_id, dedup_hash)
);

CREATE INDEX idx_transactions_account_id       ON public.transactions(account_id);
CREATE INDEX idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_category         ON public.transactions(category);
CREATE INDEX idx_transactions_transfer_id      ON public.transactions(transfer_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transfers: visible if you own either the source or destination account
CREATE POLICY "transfers_select_own" ON public.transfers FOR SELECT
    USING (
        from_account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
        OR
        to_account_id   IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    );

CREATE POLICY "transfers_insert_own" ON public.transfers FOR INSERT
    WITH CHECK (
        from_account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    );

CREATE POLICY "transfers_delete_own" ON public.transfers FOR DELETE
    USING (
        from_account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    );

-- Import batches: own accounts only
CREATE POLICY "import_batches_all_own" ON public.import_batches FOR ALL
    USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Transactions: own accounts only
CREATE POLICY "transactions_all_own" ON public.transactions FOR ALL
    USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
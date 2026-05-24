/**
 * useAccountDetail
 *
 * Two separate effects:
 *   1. Fetch account once on mount (accountId changes only)
 *   2. Fetch transactions whenever filter/limit/offset changes
 *
 * This avoids re-fetching the account header on every filter tab click,
 * and makes the filter re-fetch instant without a full loading flash.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Account {
  id: string;
  name: string;
  type: 'chequing' | 'savings' | 'investment' | 'credit_card';
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  direction: 'in' | 'out';
  category: string;
  merchant: string | null;
  description_raw: string | null;
  transaction_date: string;
  is_recurring: boolean;
  transfer_id: string | null;
  notes: string | null;
  created_at: string;
}

export type TransactionFilter = 'all' | 'in' | 'out';

interface UseAccountDetailReturn {
  account: Account | null;
  transactions: Transaction[];   // filtered by current filter tab
  allTransactions: Transaction[]; // always the full unfiltered set — used by chart
  loading: boolean;
  txLoading: boolean;
  error: string | null;
  refetch: () => void;
  refetchTransactions: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAccountDetail(
  accountId: string,
  filter: TransactionFilter = 'all',
  limit = 200, // fetch enough for the chart — no pagination UI yet
  offset = 0
): UseAccountDetailReturn {
  const { getAccessToken } = useAuth();

  const [account, setAccount] = useState<Account | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side filter — backend has no direction param on this endpoint
  const transactions = filter === 'all'
    ? allTransactions
    : allTransactions.filter((t) => t.direction === filter);

  // -- Account fetch (runs once per accountId) -------------------------------
  const fetchAccount = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/accounts/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load account (${res.status})`);
      const data: Account = await res.json();
      setAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account');
    }
  }, [accountId, getAccessToken]);

  // -- Transaction fetch (runs on filter/limit/offset change) ---------------
  const fetchTransactions = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      // direction is filtered client-side — backend does not support this param

      const res = await fetch(
        `${API_URL}/accounts/${accountId}/transactions?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Failed to load transactions (${res.status})`);

      const raw = await res.json();
      // Normalise: FastAPI may return bare array or { items, total, limit, offset }
      const data: Transaction[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.data)
        ? raw.data
        : [];
      setAllTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    }
  }, [accountId, limit, offset, getAccessToken]);

  // Effect 1: initial load — fetch account + transactions together
  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchAccount(), fetchTransactions()]).finally(() =>
      setLoading(false)
    );
    // Only re-run when the account ID itself changes (navigating between accounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // Effect 2: filter change — re-fetch only transactions, no loading flash
  useEffect(() => {
    if (!accountId || loading) return; // skip during initial load
    setTxLoading(true);
    fetchTransactions().finally(() => setTxLoading(false));
  }, [filter, limit, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchAccount(), fetchTransactions()]).finally(() =>
      setLoading(false)
    );
  }, [fetchAccount, fetchTransactions]);

  return {
    account,
    transactions,       // filtered view — drives the table
    allTransactions,    // full set — drives the chart
    loading,
    txLoading,
    error,
    refetch,
    refetchTransactions: fetchTransactions,
  };
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

export interface CreateTransactionPayload {
  amount: number;
  category: string;
  merchant?: string;
  description_raw?: string;
  transaction_date: string;
  is_recurring?: boolean;
  notes?: string;
}

export async function createTransaction(
  accountId: string,
  payload: CreateTransactionPayload,
  getAccessToken: () => Promise<string | null>
): Promise<Transaction> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/accounts/${accountId}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 409) {
    throw new Error('This transaction already exists (duplicate detected).');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Failed to create transaction (${res.status})`);
  }
  return res.json();
}

export interface CreateTransferPayload {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  notes?: string;
}

export async function createTransfer(
  payload: CreateTransferPayload,
  getAccessToken: () => Promise<string | null>
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Failed to create transfer (${res.status})`);
  }
}
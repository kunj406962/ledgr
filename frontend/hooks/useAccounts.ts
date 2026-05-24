'use client';

/**
 * useAccounts — custom hook for fetching the current user's accounts from FastAPI.
 *
 * Design decisions:
 * - Uses getAccessToken() from AuthContext to attach the Supabase JWT on every request.
 * - Returns loading, error, and accounts state; caller decides how to render each state.
 * - refetch() is exposed so the accounts page can re-fetch after creating a new account.
 * - No external library dependency — plain fetch keeps the bundle lean.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'chequing' | 'savings' | 'investment' | 'credit_card';
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
}

interface UseAccountsReturn {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAccounts(): UseAccountsReturn {
  const { getAccessToken } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load accounts (${res.status})`);
      }

      const data: Account[] = await res.json();
      // Only show active accounts on the UI; soft-deleted ones are excluded
      setAccounts(data.filter((a) => a.is_active));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, loading, error, refetch: fetchAccounts };
}

/**
 * createAccount — standalone async function so the modal can call it directly.
 * Returns the created Account on success, throws on failure.
 */
export async function createAccount(
  payload: {
    name: string;
    type: Account['type'];
    currency?: string;
    opening_balance?: number;
  },
  getAccessToken: () => Promise<string | null>
): Promise<Account> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const res = await fetch(`${apiUrl}/accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.name,
      type: payload.type,
      currency: payload.currency ?? 'CAD',
      opening_balance: payload.opening_balance ?? 0,
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `Failed to create account (${res.status})`);
  }

  return res.json();
}
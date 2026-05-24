/**
 * __tests__/hooks/useAccountDetail.test.ts
 *
 * Tests for useAccountDetail hook and the standalone mutation helpers
 * createTransaction / createTransfer.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useAccountDetail, createTransaction, createTransfer } from '../../hooks/useAccountDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAccessToken = jest.fn().mockResolvedValue('mock-token');

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: mockGetAccessToken }),
}));

const ACCOUNT_ID = 'acc-123';

const mockAccount = {
  id: ACCOUNT_ID,
  name: 'TD Chequing',
  type: 'chequing',
  currency: 'CAD',
  opening_balance: 1000,
  current_balance: 1358.31,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
};

const mockTransactions = [
  {
    id: 'txn-1',
    account_id: ACCOUNT_ID,
    amount: 358.31,
    direction: 'in',
    category: 'Salary',
    merchant: 'Meridian Tech',
    description_raw: 'PAYROLL DEP',
    transaction_date: '2025-01-15',
    is_recurring: true,
    transfer_id: null,
    notes: null,
    created_at: '2025-01-15T00:00:00Z',
  },
];

// ─── useAccountDetail ─────────────────────────────────────────────────────────

describe('useAccountDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in loading state', () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAccount,
    });

    const { result } = renderHook(() => useAccountDetail(ACCOUNT_ID));
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeNull();
    expect(result.current.transactions).toEqual([]);
  });

  it('fetches account and transactions successfully', async () => {
    global.fetch = jest
      .fn()
      // First call: GET /accounts/:id
      .mockResolvedValueOnce({ ok: true, json: async () => mockAccount })
      // Second call: GET /accounts/:id/transactions
      .mockResolvedValueOnce({ ok: true, json: async () => mockTransactions });

    const { result } = renderHook(() => useAccountDetail(ACCOUNT_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.account).toEqual(mockAccount);
    expect(result.current.transactions).toEqual(mockTransactions);
    expect(result.current.allTransactions).toEqual(mockTransactions); // full unfiltered set
    expect(result.current.error).toBeNull();
  });

  it('sets error when account fetch fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { result } = renderHook(() => useAccountDetail(ACCOUNT_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/404/);
    expect(result.current.account).toBeNull();
  });

  it('sets error when transactions fetch fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAccount })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    const { result } = renderHook(() => useAccountDetail(ACCOUNT_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/500/);
  });

  it('does NOT send direction as query param (filtered client-side)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAccount })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTransactions });

    renderHook(() => useAccountDetail(ACCOUNT_ID, 'in'));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const txnCall = calls.find((c: [string, RequestInit]) => c[0].includes('/transactions'));
      // direction param must NOT be in the URL — backend doesn't support it
      expect(txnCall[0]).not.toContain('direction=');
    });
  });

  it('filters transactions client-side when filter is "in"', async () => {
    const mixed = [
      { ...mockTransactions[0], direction: 'in' },
      { ...mockTransactions[0], id: 'txn-2', direction: 'out' },
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAccount })
      .mockResolvedValueOnce({ ok: true, json: async () => mixed });

    const { result } = renderHook(() => useAccountDetail(ACCOUNT_ID, 'in'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].direction).toBe('in');
    // allTransactions always has the full set
    expect(result.current.allTransactions).toHaveLength(2);
  });

  it('attaches Authorization header to both requests', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockAccount })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    renderHook(() => useAccountDetail(ACCOUNT_ID));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      calls.forEach((call: [string, RequestInit]) => {
        expect(call[1].headers).toMatchObject({
          Authorization: 'Bearer mock-token',
        });
      });
    });
  });

  it('refetch reloads both account and transactions', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => mockAccount });

    const { result } = renderHook(() => useAccountDetail(ACCOUNT_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      const callsAfter = (global.fetch as jest.Mock).mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});

// ─── createTransaction ────────────────────────────────────────────────────────

describe('createTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /accounts/:id/transactions with signed amount', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockTransactions[0], id: 'txn-new' }),
    });

    await createTransaction(
      ACCOUNT_ID,
      { amount: -45.0, category: 'Groceries', transaction_date: '2025-03-10' },
      mockGetAccessToken
    );

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain(`/accounts/${ACCOUNT_ID}/transactions`);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toMatchObject({ amount: -45.0, category: 'Groceries' });
    expect(opts.headers.Authorization).toBe('Bearer mock-token');
  });

  it('throws on 409 duplicate', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) });

    await expect(
      createTransaction(ACCOUNT_ID, { amount: -10, category: 'Food', transaction_date: '2025-01-01' }, mockGetAccessToken)
    ).rejects.toThrow('duplicate');
  });

  it('throws with API detail message on other errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Validation error' }),
    });

    await expect(
      createTransaction(ACCOUNT_ID, { amount: 0, category: 'X', transaction_date: '2025-01-01' }, mockGetAccessToken)
    ).rejects.toThrow('Validation error');
  });
});

// ─── createTransfer ───────────────────────────────────────────────────────────

describe('createTransfer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /transfers with correct payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    await createTransfer(
      {
        from_account_id: 'acc-1',
        to_account_id: 'acc-2',
        amount: 500,
        transfer_date: '2025-03-05',
        notes: 'Monthly savings',
      },
      mockGetAccessToken
    );

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/transfers');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.amount).toBe(500);
    expect(body.from_account_id).toBe('acc-1');
    expect(body.to_account_id).toBe('acc-2');
  });

  it('throws with API detail message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Insufficient balance' }),
    });

    await expect(
      createTransfer(
        { from_account_id: 'a', to_account_id: 'b', amount: 99999, transfer_date: '2025-01-01' },
        mockGetAccessToken
      )
    ).rejects.toThrow('Insufficient balance');
  });
});

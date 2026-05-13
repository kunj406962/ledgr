/**
 * __tests__/app/accounts/AccountDetailPage.test.tsx
 *
 * Tests for the AccountDetailPage component.
 * Covers: loading state, error state, rendering with data, filter tabs,
 * modal open/close, back navigation link.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountDetailPage from '../app/(authenticated)/accounts/[id]/page';
import * as useAccountDetailModule from '../hooks/useAccountDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'acc-123' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Recharts — avoid canvas errors in jsdom
jest.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

// Modals — stub out to keep tests focused on the page
jest.mock('../components/accountDetails/AddTransactionModal', () => ({
  AddTransactionModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Add Transaction">
        <button onClick={onClose}>Close AddTransaction</button>
      </div>
    ) : null,
}));

jest.mock('../components/accountDetails/TransferModal', () => ({
  TransferModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Transfer Between Accounts">
        <button onClick={onClose}>Close Transfer</button>
      </div>
    ) : null,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAccount: useAccountDetailModule.Account = {
  id: 'acc-123',
  name: 'TD Chequing',
  type: 'chequing',
  currency: 'CAD',
  opening_balance: 1000,
  current_balance: 1358.31,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
};

const mockTransactions: useAccountDetailModule.Transaction[] = [
  {
    id: 'txn-1',
    account_id: 'acc-123',
    amount: 3650,
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
  {
    id: 'txn-2',
    account_id: 'acc-123',
    amount: -45.5,
    direction: 'out',
    category: 'Groceries',
    merchant: 'Safeway',
    description_raw: 'POS DEBIT SAFEWAY',
    transaction_date: '2025-01-20',
    is_recurring: false,
    transfer_id: null,
    notes: null,
    created_at: '2025-01-20T00:00:00Z',
  },
];

const mockUseAccountDetail = jest.spyOn(useAccountDetailModule, 'useAccountDetail');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AccountDetailPage — loading state', () => {
  it('renders skeleton when loading', () => {
    mockUseAccountDetail.mockReturnValue({
      account: null,
      transactions: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    // Skeleton uses animate-pulse — check it's rendered instead of account name
    expect(screen.queryByText('TD Chequing')).toBeNull();
  });
});

describe('AccountDetailPage — error state', () => {
  it('renders error state with retry button', () => {
    mockUseAccountDetail.mockReturnValue({
      account: null,
      transactions: [],
      loading: false,
      error: 'Failed to load account (404)',
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to load account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls refetch when Retry is clicked', async () => {
    const mockRefetch = jest.fn();
    mockUseAccountDetail.mockReturnValue({
      account: null,
      transactions: [],
      loading: false,
      error: 'Error',
      refetch: mockRefetch,
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalled();
  });
});

describe('AccountDetailPage — populated state', () => {
  beforeEach(() => {
    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: mockTransactions,
      allTransactions: mockTransactions,
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });
  });

  it('renders account name and balance', () => {
    render(<AccountDetailPage />);
    expect(screen.getByText('TD Chequing')).toBeInTheDocument();
    expect(screen.getByText('$1,358.31')).toBeInTheDocument();
  });

  it('renders back link to /accounts', () => {
    render(<AccountDetailPage />);
    expect(screen.getByRole('link', { name: /all accounts/i })).toHaveAttribute('href', '/accounts');
  });

  it('renders all transactions by default', () => {
    render(<AccountDetailPage />);
    expect(screen.getByText('Meridian Tech')).toBeInTheDocument();
    expect(screen.getByText('Safeway')).toBeInTheDocument();
  });

  it('renders the balance history chart when there are 2+ transactions', () => {
    render(<AccountDetailPage />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('does not render chart with 0 transactions', () => {
    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    expect(screen.queryByTestId('area-chart')).toBeNull();
  });

  it('shows empty state when no transactions match filter', () => {
    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });
});

describe('AccountDetailPage — filter tabs', () => {
  it('re-fetches with direction=in when Income tab is clicked', async () => {
    // The hook is called again when filter state changes
    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: mockTransactions,
      allTransactions: mockTransactions,
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /income/i }));

    // Hook should have been called with filter='in'
    const calls = (mockUseAccountDetail as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe('in');
  });

  it('re-fetches with direction=out when Expenses tab is clicked', async () => {
    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: mockTransactions,
      allTransactions: mockTransactions,
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /expenses/i }));

    const calls = (mockUseAccountDetail as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe('out');
  });
});

describe('AccountDetailPage — modals', () => {
  beforeEach(() => {
    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: mockTransactions,
      allTransactions: mockTransactions,
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });
  });

  it('opens AddTransactionModal when Add Transaction is clicked', async () => {
    render(<AccountDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));
    expect(screen.getByRole('dialog', { name: /add transaction/i })).toBeInTheDocument();
  });

  it('closes AddTransactionModal', async () => {
    render(<AccountDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));
    await userEvent.click(screen.getByRole('button', { name: /close addtransaction/i }));
    expect(screen.queryByRole('dialog', { name: /add transaction/i })).toBeNull();
  });

  it('opens TransferModal when Transfer is clicked', async () => {
    render(<AccountDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /transfer/i }));
    expect(screen.getByRole('dialog', { name: /transfer between accounts/i })).toBeInTheDocument();
  });

  it('closes TransferModal', async () => {
    render(<AccountDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /transfer/i }));
    await userEvent.click(screen.getByRole('button', { name: /close transfer/i }));
    expect(screen.queryByRole('dialog', { name: /transfer between accounts/i })).toBeNull();
  });
});

describe('AccountDetailPage — credit card styling', () => {
  it('shows amber balance class for credit_card account type', () => {
    mockUseAccountDetail.mockReturnValue({
      account: { ...mockAccount, type: 'credit_card', current_balance: -500 },
      transactions: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    const balanceEl = screen.getByText('$500.00');
    expect(balanceEl.className).toContain('accent-warning');
  });
});

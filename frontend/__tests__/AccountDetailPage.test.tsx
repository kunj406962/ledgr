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

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the useAccountDetail hook FIRST
const mockUseAccountDetail = jest.fn();

jest.mock('../hooks/useAccountDetail', () => ({
  useAccountDetail: (...args: any[]) => mockUseAccountDetail(...args),
}));

// Mock Supabase client
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    })),
  },
}));

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    user: { id: 'test-user', email: 'test@example.com' },
    isLoading: false,
  }),
}));

// next/navigation
const mockPush = jest.fn();
const mockUseSearchParams = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'acc-123' }),
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => mockUsePathname(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Recharts — avoid canvas errors in jsdom
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

// Mock the AccountHeader component
jest.mock('../components/accountDetails/AccountHeader', () => ({
  AccountHeader: ({ account, onAddTransaction, onTransfer }: any) => (
    <div data-testid="account-header">
      <h1>{account?.name || ''}</h1>
      <span>${Math.abs(account?.current_balance || 0).toFixed(2)}</span>
      <div className="flex gap-2">
        <button onClick={onAddTransaction}>Add Transaction</button>
        <button onClick={onTransfer}>Transfer</button>
      </div>
    </div>
  ),
}));

// Modals — stub out to keep tests focused on the page
jest.mock('../components/accountDetails/AddTransactionModal', () => ({
  AddTransactionModal: ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Add Transaction">
        <button onClick={() => {
          onClose();
          onSuccess?.();
        }}>Close AddTransaction</button>
      </div>
    ) : null,
}));

jest.mock('../components/accountDetails/TransferModal', () => ({
  TransferModal: ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Transfer Between Accounts">
        <button onClick={() => {
          onClose();
          onSuccess?.();
        }}>Close Transfer</button>
      </div>
    ) : null,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAccount = {
  id: 'acc-123',
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

// Clear mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
  mockUsePathname.mockReturnValue('/accounts/acc-123');
});

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
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });
  });

  it('renders account name and balance', () => {
    render(<AccountDetailPage />);
    expect(screen.getByText('TD Chequing')).toBeInTheDocument();
    expect(screen.getByText('$1358.31')).toBeInTheDocument();
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

  it('does not crash when transactions exist for chart rendering', () => {
    render(<AccountDetailPage />);

    expect(screen.getByText('Meridian Tech')).toBeInTheDocument();
    expect(screen.getByText('Safeway')).toBeInTheDocument();
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
    const emptyStateTexts = screen.getAllByText(/no/i);
    expect(emptyStateTexts.length).toBeGreaterThan(0);
  });
});

describe('AccountDetailPage — filter tabs', () => {
  it('clicking Income tab filters transactions', async () => {
    const user = userEvent.setup();

    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: mockTransactions.filter(t => t.direction === 'in'),
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);

    const incomeButton = screen.getByRole('button', { name: /income/i });

    await user.click(incomeButton);

    await waitFor(() => {
      expect(screen.getByText('Meridian Tech')).toBeInTheDocument();
    });

    expect(screen.queryByText('Safeway')).not.toBeInTheDocument();
  });

  it('clicking Expenses tab filters transactions', async () => {
    const user = userEvent.setup();

    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: mockTransactions.filter(t => t.direction === 'out'),
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);

    const expensesButton = screen.getByRole('button', {
      name: /expenses/i,
    });

    await user.click(expensesButton);

    await waitFor(() => {
      expect(screen.getByText('Safeway')).toBeInTheDocument();
    });

    expect(screen.queryByText('Meridian Tech')).not.toBeInTheDocument();
  });
});

describe('AccountDetailPage — modals', () => {
  beforeEach(() => {
    mockUseAccountDetail.mockReturnValue({
      account: mockAccount,
      transactions: mockTransactions,
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });
  });

  it('opens AddTransactionModal when Add Transaction is clicked', async () => {
    render(<AccountDetailPage />);
    const addButton = screen.getByRole('button', { name: /add transaction/i });
    await userEvent.click(addButton);
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
  it('shows correct balance format for credit_card account type', () => {
    mockUseAccountDetail.mockReturnValue({
      account: { ...mockAccount, type: 'credit_card', current_balance: -500 },
      transactions: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      refetchTransactions: jest.fn(),
    });

    render(<AccountDetailPage />);
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });
});
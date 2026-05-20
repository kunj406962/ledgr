// Mock AuthContext first
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    user: { id: 'user-123', email: 'test@example.com' },
    isLoading: false,
  }),
}));

// Mock supabase to prevent initialization errors
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

// Mock dependencies
jest.mock('../../../components/accountDetails/TransactionModal', () => ({
  TransactionModal: ({ isOpen, transaction, onClose }: any) =>
    isOpen ? (
      <div role="dialog">
        <p>{transaction?.merchant ?? transaction?.category}</p>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionTable } from '../../../components/accountDetails/TransactionTable';

const txns = [
  {
    id: 'txn-1', account_id: 'acc-1', amount: 3650, direction: 'in' as const,
    category: 'Salary', merchant: 'Meridian Tech', description_raw: null,
    transaction_date: '2025-03-01', is_recurring: true, transfer_id: null,
    notes: null, created_at: '2025-03-01T00:00:00Z',
  },
  {
    id: 'txn-2', account_id: 'acc-1', amount: -45.5, direction: 'out' as const,
    category: 'Groceries', merchant: 'Safeway', description_raw: null,
    transaction_date: '2025-03-05', is_recurring: false, transfer_id: null,
    notes: null, created_at: '2025-03-05T00:00:00Z',
  },
];

const defaultProps = {
  transactions: txns,
  filter: 'all' as const,
  onFilterChange: jest.fn(),
  onSuccess: jest.fn(),
};

describe('TransactionTable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders all transactions', () => {
    render(<TransactionTable {...defaultProps} />);
    expect(screen.getByText('Meridian Tech')).toBeInTheDocument();
    expect(screen.getByText('Safeway')).toBeInTheDocument();
  });

  it('calls onFilterChange when Income tab clicked', async () => {
    render(<TransactionTable {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /income/i }));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('in');
  });

  it('calls onFilterChange when Expenses tab clicked', async () => {
    render(<TransactionTable {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /expenses/i }));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('out');
  });

  it('opens TransactionModal when a row is clicked', async () => {
    render(<TransactionTable {...defaultProps} />);
    await userEvent.click(screen.getByText('Safeway'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Check that the modal contains Safeway text
    expect(screen.getByRole('dialog')).toHaveTextContent('Safeway');
  });

  it('closes modal when onClose is called', async () => {
    render(<TransactionTable {...defaultProps} />);
    await userEvent.click(screen.getByText('Safeway'));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows empty state when transactions is empty', () => {
    render(<TransactionTable {...defaultProps} transactions={[]} />);
    // Target the specific heading text
    expect(screen.getByText('No transactions')).toBeInTheDocument();
    // Also verify the helper text appears
    expect(screen.getByText(/This account has no transactions yet/)).toBeInTheDocument();
  });

  it('renders income amounts in positive format', () => {
    render(<TransactionTable {...defaultProps} />);
    expect(screen.getByText('+$3,650.00')).toBeInTheDocument();
  });
});
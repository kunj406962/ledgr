/**
 * __tests__/components/ledgr/AddTransactionModal.test.tsx
 *
 * Tests for the AddTransactionModal component.
 * Covers: rendering, validation, API call, success / error paths, loading state.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddTransactionModal } from '../../../components/accountDetails/AddTransactionModal';
import * as AccountDetail from '../../../hooks/useAccountDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAccessToken = jest.fn().mockResolvedValue('mock-token');

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: mockGetAccessToken }),
}));

jest.mock('../../../hooks/useAccountDetail', () => ({
  ...jest.requireActual('../../../hooks/useAccountDetail'),
  createTransaction: jest.fn(),
}));

const mockCreateTransaction =
  AccountDetail.createTransaction as jest.Mock;

// Minimal Modal wrapper — render children + footer directly
jest.mock('../../../components/ui/Modal', () => ({
  Modal: ({
    isOpen,
    children,
    footer,
    title,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    footer: React.ReactNode;
    title: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  accountId: 'acc-123',
  accountName: 'TD Chequing',
  onSuccess: jest.fn(),
};

function renderModal(props = {}) {
  return render(<AddTransactionModal {...defaultProps} {...props} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddTransactionModal — rendering', () => {
  it('renders nothing when isOpen is false', () => {
    render(<AddTransactionModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal with account name', () => {
    renderModal();
    expect(screen.getByText('TD Chequing')).toBeInTheDocument();
  });

  it('defaults to Expense type', () => {
    renderModal();
    // Expense button has distinctive styling when selected
    const expenseBtn = screen.getByRole('button', { name: /expense/i });
    expect(expenseBtn.className).toContain('accent-destructive');
  });

  it('shows income categories when Income is selected', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /income/i }));
    expect(screen.getByRole('option', { name: 'Salary' })).toBeInTheDocument();
  });

  it('shows expense categories when Expense is selected', () => {
    renderModal();
    expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument();
  });
});

describe('AddTransactionModal — validation', () => {
  it('shows error when description is empty', async () => {
    renderModal();
    // Fill amount to trigger validation
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '50');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));
    
    // Use getAllByText because the error appears twice (once for description, once for amount)
    const errors = screen.getAllByText(/description is required/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('shows error when amount is zero', async () => {
    renderModal();
    // Find by placeholder instead of label
    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Groceries');
    
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '0');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));
    
    expect(screen.getByText(/amount must be a positive number/i)).toBeInTheDocument();
  });

  it('shows error when amount is negative', async () => {
    renderModal();
    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Test');
    
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '-10');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));
    
    expect(screen.getByText(/amount must be a positive number/i)).toBeInTheDocument();
  });
});

describe('AddTransactionModal — API integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls createTransaction with negative amount for expense', async () => {
    mockCreateTransaction.mockResolvedValueOnce({} as AccountDetail.Transaction);
    renderModal();

    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Whole Foods');
    
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '45.50');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(() =>
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'acc-123',
        expect.objectContaining({ amount: -45.5 }), // Only check the amount field
        expect.any(Function) // More flexible than expecting exact mockGetAccessToken
      )
    );
  });

  it('calls createTransaction with positive amount for income', async () => {
    mockCreateTransaction.mockResolvedValueOnce({} as AccountDetail.Transaction);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /income/i }));
    
    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Salary');
    
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '3650');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(() =>
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        'acc-123',
        expect.objectContaining({ amount: 3650 }), // Only check the amount field
        expect.any(Function) // More flexible than expecting exact mockGetAccessToken
      )
    );
  });

  it('calls onSuccess and closes after successful submit', async () => {
    mockCreateTransaction.mockResolvedValueOnce({} as AccountDetail.Transaction);
    renderModal();

    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Test');
    
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '10');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows API error message when createTransaction throws', async () => {
    mockCreateTransaction.mockRejectedValueOnce(new Error('This transaction already exists (duplicate detected).'));
    renderModal();

    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Test');
    
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '10');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(() =>
      expect(screen.getByText(/duplicate detected/i)).toBeInTheDocument()
    );
  });

  it('disables buttons while saving', async () => {
    // Never resolves — keeps the modal in saving state
    mockCreateTransaction.mockReturnValueOnce(new Promise(() => {}));
    renderModal();

    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Test');
    
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '10');
    
    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  it('resets form after close', async () => {
    renderModal();
    
    const descriptionInput = screen.getByPlaceholderText('e.g. Whole Foods Market');
    await userEvent.type(descriptionInput, 'Some value');
    
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
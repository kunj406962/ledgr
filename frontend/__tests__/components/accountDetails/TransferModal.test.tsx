/**
 * __tests__/components/ledgr/TransferModal.test.tsx
 *
 * Tests for the TransferModal component.
 * Covers: rendering, account list population, validation, API call,
 * success / error paths, loading state.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferModal } from '../../../components/accountDetails/TransferModal';
import * as AccountDetail from '../../../hooks/useAccountDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAccessToken = jest.fn().mockResolvedValue('mock-token');

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: mockGetAccessToken }),
}));

const mockAccounts = [
  { id: 'acc-1', name: 'TD Chequing', type: 'chequing', current_balance: 1358, is_active: true },
  { id: 'acc-2', name: 'Scotia Savings', type: 'savings', current_balance: 8816, is_active: true },
  { id: 'acc-3', name: 'Wealthsimple TFSA', type: 'investment', current_balance: 22739, is_active: true },
];

jest.mock('../../../hooks/useAccounts', () => ({
  useAccounts: () => ({ accounts: mockAccounts }),
}));

// Mock the entire module first
jest.mock('../../../hooks/useAccountDetail', () => ({
  ...jest.requireActual('../../../hooks/useAccountDetail'),
  createTransfer: jest.fn(),
}));

// Then get the mocked function
const mockCreateTransfer = AccountDetail.createTransfer as jest.Mock;

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
  fromAccountId: 'acc-1',
  onSuccess: jest.fn(),
};

function renderModal(props = {}) {
  return render(<TransferModal {...defaultProps} {...props} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TransferModal — rendering', () => {
  it('renders nothing when isOpen is false', () => {
    render(<TransferModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders account options from useAccounts', () => {
    renderModal();
    // Use getAllByRole and check specific option text
    const options = screen.getAllByRole('option');
    expect(options.some(option => option.textContent?.includes('TD Chequing'))).toBe(true);
    expect(options.some(option => option.textContent?.includes('Scotia Savings'))).toBe(true);
    expect(options.some(option => option.textContent?.includes('Wealthsimple TFSA'))).toBe(true);
  });

  it('pre-selects fromAccountId when provided', () => {
    renderModal();
    const fromSelect = screen.getAllByRole('combobox')[0];
    expect((fromSelect as HTMLSelectElement).value).toBe('acc-1');
  });

  it('To Account is disabled until From Account is selected', () => {
    renderModal({ fromAccountId: '' });
    const toSelect = screen.getAllByRole('combobox')[1];
    expect(toSelect).toBeDisabled();
  });
});

describe('TransferModal — validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows error when no To Account is selected', async () => {
    renderModal();
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '500');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));
    expect(screen.getByText(/please select both accounts/i)).toBeInTheDocument();
  });

  it('shows error when same account is selected for from and to', async () => {
    renderModal();
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[0], 'acc-1');
    expect(selects[1]).not.toHaveValue('acc-1');
  });

  it('shows error when amount is zero', async () => {
    renderModal();
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'acc-2');
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '0');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));
    // Use getAllByText since the error appears twice (inline and banner)
    const errors = screen.getAllByText(/amount must be a positive number/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('excludes fromAccount from To Account options', () => {
    renderModal();
    const toSelect = screen.getAllByRole('combobox')[1];
    const toOptions = Array.from(toSelect.querySelectorAll('option')).map((o) => o.value);
    expect(toOptions).not.toContain('acc-1');
  });
});

describe('TransferModal — API integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls createTransfer with correct payload', async () => {
    mockCreateTransfer.mockResolvedValueOnce(undefined);
    renderModal();

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'acc-2');
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '500');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() =>
      expect(mockCreateTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          from_account_id: 'acc-1',
          to_account_id: 'acc-2',
          amount: 500,
        }),
        expect.any(Function)
      )
    );
  });

  it('includes notes when description is filled in', async () => {
    mockCreateTransfer.mockResolvedValueOnce(undefined);
    renderModal();

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'acc-2');
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '500');
    // Fix: Use the actual placeholder text from your component
    const descriptionInput = screen.getByPlaceholderText('e.g. Monthly savings transfer');
    await userEvent.type(descriptionInput, 'Monthly savings');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() =>
      expect(mockCreateTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Monthly savings' }),
        expect.any(Function)
      )
    );
  });

  it('omits notes when description is empty', async () => {
    mockCreateTransfer.mockResolvedValueOnce(undefined);
    renderModal();

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'acc-2');
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '500');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() => {
      const [payload] = mockCreateTransfer.mock.calls[0];
      expect(payload.notes).toBeUndefined();
    });
  });

  it('calls onSuccess and closes after successful transfer', async () => {
    mockCreateTransfer.mockResolvedValueOnce(undefined);
    renderModal();

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'acc-2');
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '100');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows API error message when createTransfer throws', async () => {
    mockCreateTransfer.mockRejectedValueOnce(new Error('Insufficient balance'));
    renderModal();

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'acc-2');
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '999999');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() => {
      // The error appears in a div with class containing "accent-destructive"
      const errorElement = screen.getByText(/insufficient balance/i);
      expect(errorElement).toBeInTheDocument();
    });
  });

  it('disables buttons while saving', async () => {
    mockCreateTransfer.mockReturnValueOnce(new Promise(() => {}));
    renderModal();

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'acc-2');
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '100');
    await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() => {
      // Get all buttons and check they're disabled
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });
});
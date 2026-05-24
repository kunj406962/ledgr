import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionModal } from '../../../components/accountDetails/TransactionModal';

const mockGetAccessToken = jest.fn().mockResolvedValue('mock-token');
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ getAccessToken: mockGetAccessToken }) }));
jest.mock('../../../components/accountDetails/TransferDeleteModal', () => ({
  TransferDeleteModal: () => null,
}));

const mockTx = {
  id: 'txn-1', account_id: 'acc-123', amount: -45.5, direction: 'out' as const,
  category: 'Groceries', merchant: 'Safeway', description_raw: 'POS DEBIT',
  transaction_date: '2025-03-10', is_recurring: false,
  transfer_id: null, notes: null, created_at: '2025-03-10T00:00:00Z',
};

const transferTx = { ...mockTx, id: 'txn-2', transfer_id: 'tfr-1', category: 'Transfer', merchant: null };

const defaultProps = {
  isOpen: true,
  transaction: mockTx,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
  onDeleteTransfer: jest.fn(),
};

describe('TransactionModal — view mode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when closed', () => {
    render(<TransactionModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Safeway')).toBeNull();
  });

  it('shows merchant, category, and amount', () => {
    render(<TransactionModal {...defaultProps} />);
    expect(screen.getAllByText('Safeway')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Groceries')[0]).toBeInTheDocument();
    expect(screen.getByText(/-\$45\.50/)).toBeInTheDocument();
  });

  it('shows Edit and Delete buttons for non-transfer', () => {
    render(<TransactionModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows Delete Transfer and no Edit for transfer rows', () => {
    render(<TransactionModal {...defaultProps} transaction={transferTx} />);
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /delete transfer/i })).toBeInTheDocument();
  });
});

describe('TransactionModal — edit mode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enters edit mode when Edit is clicked', async () => {
    render(<TransactionModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByText(/amount cannot be changed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('calls PATCH with updated fields on save', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => mockTx });
    render(<TransactionModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    
    // Find select by its current value since there's no accessible name
    const categorySelect = screen.getByDisplayValue('Groceries');
    await userEvent.selectOptions(categorySelect, 'Dining');
    
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.category).toBe('Dining');
    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe('PATCH');
  });

  it('shows API error when PATCH fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 422, json: async () => ({ detail: 'Validation failed' }),
    });
    render(<TransactionModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(screen.getByText('Validation failed')).toBeInTheDocument());
  });

  it('goes back to view mode when Back is clicked', async () => {
    render(<TransactionModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getAllByText('Safeway')[0]).toBeInTheDocument();
  });
});

describe('TransactionModal — delete mode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enters confirm-delete mode when Delete is clicked', async () => {
    render(<TransactionModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByText(/soft-delete the transaction/i)).toBeInTheDocument();
  });

  it('calls DELETE and onSuccess on confirm', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<TransactionModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalled());
    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe('DELETE');
  });

  it('shows API error when DELETE fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ detail: 'DB error' }),
    });
    render(<TransactionModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText('DB error')).toBeInTheDocument());
  });
});
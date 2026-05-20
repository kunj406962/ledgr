import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferDeleteModal } from '../../../components/accountDetails/TransferDeleteModal';

const mockGetAccessToken = jest.fn().mockResolvedValue('mock-token');
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ getAccessToken: mockGetAccessToken }) }));

const mockTx = {
  id: 'txn-1', account_id: 'acc-123', amount: -100, direction: 'out' as const,
  category: 'Transfer', merchant: null, description_raw: null,
  transaction_date: '2025-03-10', is_recurring: false,
  transfer_id: 'tfr-1', notes: 'Monthly savings', created_at: '2025-03-10T00:00:00Z',
};

const defaultProps = { isOpen: true, transaction: mockTx, onClose: jest.fn(), onSuccess: jest.fn() };

describe('TransferDeleteModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when closed', () => {
    render(<TransferDeleteModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Delete Transfer/i)).toBeNull();
  });

  it('shows amount and notes', () => {
    render(<TransferDeleteModal {...defaultProps} />);
    expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Monthly savings/)).toBeInTheDocument();
  });

  it('calls DELETE and onSuccess on confirm', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    render(<TransferDeleteModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /delete transfer/i }));
    await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalled());
    expect(defaultProps.onClose).toHaveBeenCalled();
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/accounts/acc-123/transactions/txn-1');
    expect(opts.method).toBe('DELETE');
  });

  it('shows error message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ detail: 'Server error' }),
    });
    render(<TransferDeleteModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /delete transfer/i }));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(<TransferDeleteModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

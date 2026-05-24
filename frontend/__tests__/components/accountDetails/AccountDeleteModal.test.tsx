import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountDeleteModal } from '../../../components/accountDetails/AccountDeleteModal';

const mockGetAccessToken = jest.fn().mockResolvedValue('mock-token');
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ getAccessToken: mockGetAccessToken }) }));

const mockAccount = {
  id: 'acc-123', name: 'TD Chequing', type: 'chequing' as const,
  currency: 'CAD', opening_balance: 1000, current_balance: 1358,
  is_active: true, created_at: '2025-01-01T00:00:00Z',
};

const defaultProps = {
  isOpen: true,
  account: mockAccount,
  onClose: jest.fn(),
  onDeleted: jest.fn(),
};

describe('AccountDeleteModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when closed', () => {
    render(<AccountDeleteModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Delete Account/i)).toBeNull();
  });

  it('shows the account name in the confirmation prompt', () => {
    render(<AccountDeleteModal {...defaultProps} />);
    expect(screen.getAllByText('TD Chequing')[0]).toBeInTheDocument();
  });

  it('delete button is disabled until name is typed correctly', () => {
    render(<AccountDeleteModal {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /delete account/i });
    expect(btn).toBeDisabled();
  });

  it('delete button enables when name matches exactly', async () => {
    render(<AccountDeleteModal {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('TD Chequing'), 'TD Chequing');
    expect(screen.getByRole('button', { name: /delete account/i })).not.toBeDisabled();
  });

  it('calls DELETE /accounts/:id and then onDeleted on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<AccountDeleteModal {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('TD Chequing'), 'TD Chequing');
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await waitFor(() => expect(defaultProps.onDeleted).toHaveBeenCalled());
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/accounts/acc-123');
    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe('DELETE');
  });

  it('shows error when DELETE fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ detail: 'Server error' }),
    });
    render(<AccountDeleteModal {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('TD Chequing'), 'TD Chequing');
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
    expect(defaultProps.onDeleted).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(<AccountDeleteModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
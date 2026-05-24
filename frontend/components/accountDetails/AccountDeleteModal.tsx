/**
 * AccountDeleteModal
 *
 * Two-stage confirmation: user must type the account name exactly before
 * the Delete button enables. Calls DELETE /accounts/{id} (soft delete).
 * On success calls onDeleted() which redirects to /accounts.
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Account } from '@/hooks/useAccountDetail';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface AccountDeleteModalProps {
  isOpen: boolean;
  account: Account;
  onClose: () => void;
  onDeleted: () => void;
}

export function AccountDeleteModal({
  isOpen,
  account,
  onClose,
  onDeleted,
}: AccountDeleteModalProps) {
  const { getAccessToken } = useAuth();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const confirmed = typed === account.name;

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/accounts/${account.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Failed to delete account (${res.status})`);
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setTyped('');
    setError('');
    onClose();
  };

  return (
    /* Backdrop */
    <div
      className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      {/* Panel */}
      <div
        className="relative bg-card border border-border rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-10 rounded-xl bg-accent-destructive/10 flex items-center justify-center mb-2">
          <span className="text-accent-destructive text-lg">⚠</span>
        </div>

        <h2 className="text-lg font-semibold text-text-primary">Delete Account</h2>
        <p className="text-sm text-text-secondary">
          This will soft-delete <span className="font-semibold text-text-primary">{account.name}</span> and
          hide it from your dashboard. All transaction history is preserved.
          This action cannot be undone from the UI.
        </p>

        <div>
          <p className="text-xs text-text-secondary mb-2">
            Type <span className="font-mono font-semibold text-text-primary">{account.name}</span> to confirm
          </p>
          <Input
            placeholder={account.name}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>

        {error && (
          <div className="bg-accent-destructive/10 border border-accent-destructive text-accent-destructive text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={handleClose} className="flex-1" disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="flex-1 bg-accent-destructive hover:bg-accent-destructive/90 disabled:opacity-40"
            disabled={!confirmed || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete Account'}
          </Button>
        </div>
      </div>
    </div>
  );
}
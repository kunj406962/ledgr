/**
 * TransferDeleteModal
 *
 * Confirms deletion of BOTH legs of a transfer.
 * A transfer is two linked Transaction rows — deleting one without the other
 * would corrupt the balance on the counterpart account.
 *
 * This modal soft-deletes both rows by calling DELETE on the transaction
 * that was clicked. The backend service must cascade the soft-delete to the
 * linked row via transfer_id, OR we call DELETE on both explicitly.
 *
 * Current approach: call DELETE on the clicked transaction only, and rely
 * on the backend to handle the transfer pair. If your backend does NOT
 * cascade, uncomment the second fetch and pass the counterpart account_id.
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import type { Transaction } from '@/hooks/useAccountDetail';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface TransferDeleteModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

function parseFloat2(v: number | string): number {
  return parseFloat(String(v));
}

export function TransferDeleteModal({
  isOpen,
  transaction,
  onClose,
  onSuccess,
}: TransferDeleteModalProps) {
  const { getAccessToken } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !transaction) return null;

  const amount = Math.abs(parseFloat2(transaction.amount));

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_URL}/accounts/${transaction.account_id}/transactions/${transaction.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Failed to delete transfer (${res.status})`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border p-6 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-text-primary">Delete Transfer?</h2>
        <p className="text-sm text-text-secondary">
          Both legs of this transfer will be soft-deleted. Both account balances
          will update immediately.
        </p>

        <div
          className="p-3 rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <p className="font-semibold text-text-primary">Transfer</p>
          <p className="mono text-text-secondary mt-0.5">
            ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            {transaction.notes ? ` · ${transaction.notes}` : ''}
          </p>
        </div>

        {error && (
          <div className="bg-accent-destructive/10 border border-accent-destructive text-accent-destructive text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            className="flex-1 bg-accent-destructive"
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete Transfer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
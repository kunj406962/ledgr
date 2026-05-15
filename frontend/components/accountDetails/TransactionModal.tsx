/**
 * TransactionModal
 *
 * Opens when a transaction row is clicked.
 * Shows full transaction detail with two actions:
 *
 *   Edit   — lets user change category, merchant, date, notes (NOT amount).
 *            Amount is immutable by design — wrong amounts require delete + re-create.
 *            Calls PATCH /accounts/{account_id}/transactions/{id}
 *
 *   Delete — soft delete with a simple confirmation step.
 *            Calls DELETE /accounts/{account_id}/transactions/{id}
 *
 * For transfer rows (transfer_id !== null):
 *   - Edit is disabled (transfers are atomic pairs, editing one leg corrupts balance)
 *   - Delete shows TransferDeleteModal instead
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

import type { Transaction } from '@/hooks/useAccountDetail';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const CATEGORIES = [
  'Housing', 'Groceries', 'Dining', 'Transportation', 'Software',
  'Entertainment', 'Healthcare', 'Shopping', 'Salary', 'Freelance',
  'Investment Returns', 'Gift', 'Transfer', 'Other Income', 'Other',
];

interface TransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
  onDeleteTransfer: (tx: Transaction) => void; // handed up to TransactionTable which owns TransferDeleteModal
}

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatCurrency(val: number | string): string {
  const n = parseFloat(String(val));
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

type Mode = 'view' | 'edit' | 'confirmDelete';

export function TransactionModal({
  isOpen,
  transaction,
  onClose,
  onSuccess,
  onDeleteTransfer,
}: TransactionModalProps) {
  const { getAccessToken } = useAuth();

  const [mode, setMode] = useState<Mode>('view');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit form state — initialised from transaction when entering edit mode
  const [editCategory, setEditCategory] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  if (!isOpen || !transaction) return null;

  const isTransfer = transaction.transfer_id !== null;
  const amount = parseFloat(String(transaction.amount));
  const isIncome = transaction.direction === 'in';

  const enterEdit = () => {
    setEditCategory(transaction.category);
    setEditMerchant(transaction.merchant ?? '');
    setEditDate(transaction.transaction_date);
    setEditNotes(transaction.notes ?? '');
    setError('');
    setMode('edit');
  };

  const handleClose = () => {
    setMode('view');
    setError('');
    onClose();
  };

  // ── PATCH ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_URL}/accounts/${transaction.account_id}/transactions/${transaction.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            category: editCategory,
            merchant: editMerchant || null,
            transaction_date: editDate,
            notes: editNotes || null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Failed to update (${res.status})`);
      }
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setSaving(true);
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
        throw new Error(body?.detail ?? `Failed to delete (${res.status})`);
      }
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={handleClose}
      >
        <div
          className="relative bg-card border border-border rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── VIEW MODE ─────────────────────────────────────────────────── */}
          {mode === 'view' && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
                    {isTransfer ? 'Transfer' : transaction.category}
                  </p>
                  <p className="font-semibold text-text-primary text-lg">
                    {transaction.merchant ?? transaction.description_raw ?? transaction.notes ?? transaction.category}
                  </p>
                </div>
                <span
                  className={`mono text-xl font-bold ${isIncome ? 'text-accent-primary' : 'text-accent-destructive'}`}
                >
                  {formatCurrency(amount)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <Row label="Date" value={formatDate(transaction.transaction_date)} />
                <Row label="Category" value={transaction.category} />
                {transaction.merchant && <Row label="Merchant" value={transaction.merchant} />}
                {transaction.notes && <Row label="Notes" value={transaction.notes} />}
                {transaction.is_recurring && <Row label="Recurring" value="Yes" />}
                {isTransfer && <Row label="Type" value="Transfer (linked pair)" />}
              </div>

              {isTransfer ? (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-text-secondary">
                    Transfers are atomic pairs. Editing one leg would corrupt balances.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={handleClose} className="flex-1">
                      Close
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => { handleClose(); onDeleteTransfer(transaction); }}
                      className="flex-1 text-accent-destructive border-accent-destructive"
                    >
                      Delete Transfer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" onClick={handleClose} className="flex-1">
                    Close
                  </Button>
                  <Button variant="primary" onClick={enterEdit} className="flex-1">
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setMode('confirmDelete')}
                    className="flex-1 text-accent-destructive"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── EDIT MODE ─────────────────────────────────────────────────── */}
          {mode === 'edit' && (
            <>
              <h2 className="font-semibold text-text-primary">Edit Transaction</h2>

              <div
                className="text-xs text-text-secondary p-3 rounded-lg border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
              >
                Amount cannot be changed. To correct an amount, delete this transaction and re-create it.
              </div>

              <div className="space-y-4">
                <Select
                  label="Category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
                <Input
                  label="Merchant (optional)"
                  placeholder="e.g. Whole Foods"
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                />
                <Input
                  label="Date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
                <Input
                  label="Notes (optional)"
                  placeholder="Any extra context"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-accent-destructive/10 border border-accent-destructive text-accent-destructive text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setMode('view')} className="flex-1" disabled={saving}>
                  Back
                </Button>
                <Button variant="primary" onClick={handleSave} className="flex-1" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}

          {/* ── CONFIRM DELETE ────────────────────────────────────────────── */}
          {mode === 'confirmDelete' && (
            <>
              <h2 className="font-semibold text-text-primary">Delete Transaction?</h2>
              <p className="text-sm text-text-secondary">
                This will soft-delete the transaction. The account balance will update immediately.
                The record is preserved for audit history.
              </p>

              <div
                className="p-3 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
              >
                <p className="font-semibold text-text-primary">
                  {transaction.merchant ?? transaction.description_raw ?? transaction.category}
                </p>
                <p className={`mono mt-0.5 ${isIncome ? 'text-accent-primary' : 'text-accent-destructive'}`}>
                  {formatCurrency(amount)} · {formatDate(transaction.transaction_date)}
                </p>
              </div>

              {error && (
                <div className="bg-accent-destructive/10 border border-accent-destructive text-accent-destructive text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setMode('view')} className="flex-1" disabled={saving}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="flex-1 bg-accent-destructive"
                  disabled={saving}
                >
                  {saving ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>


    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary text-right">{value}</span>
    </div>
  );
}
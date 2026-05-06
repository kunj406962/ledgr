/**
 * AddTransactionModal
 *
 * Creates a single transaction against a specific account via:
 *   POST /accounts/{accountId}/transactions
 *
 * Design rules (unchanged from original):
 *  - All CSS class names preserved verbatim
 *  - No new UI elements added
 *  - Income/Expense toggle maps to positive/negative amount sent to the API
 *    (backend derives `direction` from the sign of `amount`)
 *  - Saving state: button shows "Adding…" while in-flight
 *  - Error shown in the existing error block inside the modal
 *  - On success: calls onSuccess() then closes
 */

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { createTransaction } from '../../hooks/useAccountDetail';
import { useAuth } from '../../context/AuthContext';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
  accountName?: string;
  onSuccess?: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TRANSACTION_CATEGORIES = {
  income: ['Salary', 'Freelance', 'Investment Returns', 'Gift', 'Other Income'],
  expense: [
    'Housing',
    'Groceries',
    'Dining',
    'Transportation',
    'Software',
    'Entertainment',
    'Healthcare',
    'Shopping',
    'Other',
  ],
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function AddTransactionModal({
  isOpen,
  onClose,
  accountId,
  accountName,
  onSuccess,
}: AddTransactionModalProps) {
  const { getAccessToken } = useAuth();

  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!description.trim()) return 'Description is required';
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return 'Amount must be a positive number';
    if (!accountId) return 'No account selected';
    return null;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const parsedAmount = parseFloat(amount);
      // Income is positive, expense is negative — backend derives direction from sign
      const signedAmount = transactionType === 'income' ? parsedAmount : -parsedAmount;

      await createTransaction(
        accountId!,
        {
          amount: signedAmount,
          category,
          description_raw: description.trim(),
          transaction_date: date,
        },
        async () => getAccessToken()
      );

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset + close ─────────────────────────────────────────────────────────

  const handleClose = () => {
    setTransactionType('expense');
    setDescription('');
    setAmount('');
    setCategory('Groceries');
    setDate(new Date().toISOString().split('T')[0]);
    setError('');
    setSaving(false);
    onClose();
  };

  const categories = TRANSACTION_CATEGORIES[transactionType];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Transaction"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleClose} className="flex-1" disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            disabled={saving}
          >
            {saving ? 'Adding…' : 'Add Transaction'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Account Info */}
        {accountName && (
          <div className="bg-elevated p-4 rounded-lg border border-border">
            <div className="text-xs text-text-secondary mb-1">Account</div>
            <div className="text-sm font-semibold text-text-primary">{accountName}</div>
          </div>
        )}

        {/* Transaction Type */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Transaction Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setTransactionType('income');
                setCategory('Salary');
              }}
              className={`
                flex items-center justify-center gap-2 p-3 rounded-lg border text-left transition-all
                ${
                  transactionType === 'income'
                    ? 'bg-accent-primary/10 border-accent-primary text-text-primary'
                    : 'bg-elevated border-border text-text-secondary hover:bg-card'
                }
              `}
            >
              <ArrowUpRight
                className={`w-4 h-4 ${transactionType === 'income' ? 'text-accent-primary' : ''}`}
              />
              <span className="text-sm font-semibold">Income</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTransactionType('expense');
                setCategory('Groceries');
              }}
              className={`
                flex items-center justify-center gap-2 p-3 rounded-lg border text-left transition-all
                ${
                  transactionType === 'expense'
                    ? 'bg-accent-destructive/10 border-accent-destructive text-text-primary'
                    : 'bg-elevated border-border text-text-secondary hover:bg-card'
                }
              `}
            >
              <ArrowDownRight
                className={`w-4 h-4 ${
                  transactionType === 'expense' ? 'text-accent-destructive' : ''
                }`}
              />
              <span className="text-sm font-semibold">Expense</span>
            </button>
          </div>
        </div>

        {/* Description */}
        <Input
          label="Description"
          placeholder="e.g. Whole Foods Market"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={error && !description.trim() ? error : ''}
        />

        {/* Amount and Category */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mono"
            error={
              error && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) ? error : ''
            }
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </div>

        {/* Date */}
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* General error (e.g. API failure) */}
        {error && description.trim() && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
          <div className="bg-accent-destructive/10 border border-accent-destructive text-accent-destructive text-sm p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
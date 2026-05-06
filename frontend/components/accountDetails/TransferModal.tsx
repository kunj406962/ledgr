/**
 * TransferModal
 *
 * Creates an atomic transfer between two accounts via:
 *   POST /transfers
 *
 * Account list is loaded from useAccounts() hook (same source as the
 * accounts page) — no mock data.
 *
 * Design rules (unchanged from original):
 *  - All CSS class names preserved verbatim
 *  - No new UI elements added
 *  - Saving state: button shows "Transferring…" while in-flight
 *  - Error shown in the existing error block
 *  - On success: calls onSuccess() then closes
 */

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ArrowLeftRight } from 'lucide-react';
import { createTransfer } from '../../hooks/useAccountDetail';
import { useAccounts } from '../../hooks/useAccounts';
import { useAuth } from '../../context/AuthContext';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromAccountId?: string;
  onSuccess?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function TransferModal({
  isOpen,
  onClose,
  fromAccountId,
  onSuccess,
}: TransferModalProps) {
  const { getAccessToken } = useAuth();
  const { accounts } = useAccounts();

  const [fromAccount, setFromAccount] = useState(fromAccountId ?? '');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!fromAccount || !toAccount) {
      setError('Please select both accounts');
      return;
    }
    if (fromAccount === toAccount) {
      setError('Cannot transfer to the same account');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await createTransfer(
        {
          from_account_id: fromAccount,
          to_account_id: toAccount,
          amount: parsedAmount,
          transfer_date: date,
          notes: description.trim() || undefined,
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
    setFromAccount(fromAccountId ?? '');
    setToAccount('');
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setError('');
    setSaving(false);
    onClose();
  };

  // ── Account options ───────────────────────────────────────────────────────

  const typeLabel: Record<string, string> = {
    chequing: 'Chequing',
    savings: 'Savings',
    investment: 'Investment',
    credit_card: 'Credit Card',
  };

  const accountOptions = accounts.map((acc) => ({
    value: acc.id,
    label: `${acc.name} (${typeLabel[acc.type] ?? acc.type})`,
  }));

  const availableToAccounts = accountOptions.filter((acc) => acc.value !== fromAccount);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Transfer Between Accounts"
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
            {saving ? 'Transferring…' : 'Transfer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Transfer Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-accent-secondary/10 flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6 text-accent-secondary" />
          </div>
        </div>

        {/* From Account */}
        <Select
          label="From Account"
          value={fromAccount}
          onChange={(e) => {
            setFromAccount(e.target.value);
            if (e.target.value === toAccount) setToAccount('');
          }}
          options={[{ value: '', label: 'Select account...' }, ...accountOptions]}
        />

        {/* To Account */}
        <Select
          label="To Account"
          value={toAccount}
          onChange={(e) => setToAccount(e.target.value)}
          options={[{ value: '', label: 'Select account...' }, ...availableToAccounts]}
          disabled={!fromAccount}
        />

        {/* Amount */}
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

        {/* Description (Optional) */}
        <Input
          label="Description (Optional)"
          placeholder="e.g. Monthly savings transfer"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Date */}
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* Error */}
        {error && (
          <div className="bg-accent-destructive/10 border border-accent-destructive text-accent-destructive text-sm p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
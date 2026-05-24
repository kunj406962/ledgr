import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui//Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Landmark, PiggyBank, TrendingUp, CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createAccount } from '@/hooks/useAccounts';

type AccountType = 'Checking' | 'Savings' | 'Investment' | 'Credit Card';

// Map display labels → backend enum values
const TYPE_TO_API: Record<AccountType, 'chequing' | 'savings' | 'investment' | 'credit_card'> = {
  'Checking':    'chequing',
  'Savings':     'savings',
  'Investment':  'investment',
  'Credit Card': 'credit_card',
};

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ACCOUNT_TYPES: { value: AccountType; label: string; Icon: React.ElementType; description: string }[] = [
  { value: 'Checking',    label: 'Checking',    Icon: Landmark,   description: 'Day-to-day spending'    },
  { value: 'Savings',     label: 'Savings',     Icon: PiggyBank,  description: 'Emergency fund & goals' },
  { value: 'Investment',  label: 'Investment',  Icon: TrendingUp, description: 'TFSA, RRSP, non-reg'    },
  { value: 'Credit Card', label: 'Credit Card', Icon: CreditCard, description: 'Track what you owe'     },
];

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'AUD'];

export function AddAccountModal({ isOpen, onClose, onSuccess }: AddAccountModalProps) {
  const { getAccessToken } = useAuth();

  const [name, setName]                   = useState('');
  const [accountType, setAccountType]     = useState<AccountType>('Checking');
  const [currency, setCurrency]           = useState('CAD');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [error, setError]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);

  const handleSubmit = async () => {
    // Validation — same as before
    if (!name.trim()) {
      setError('Account name is required');
      return;
    }
    const balance = parseFloat(openingBalance);
    if (isNaN(balance)) {
      setError('Opening balance must be a valid number');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await createAccount(
        {
          name:            name.trim(),
          type:            TYPE_TO_API[accountType],
          currency,
          opening_balance: balance,
        },
        async () => await getAccessToken()
      );

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset all state on close — same as before
    setName('');
    setAccountType('Checking');
    setCurrency('CAD');
    setOpeningBalance('0');
    setError('');
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Account"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Account'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Account Name */}
        <Input
          label="Account Name"
          placeholder="e.g. TD Checking"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          error={error && !name.trim() ? error : ''}
          autoFocus
        />

        {/* Account Type */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Account Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPES.map(({ value, label, Icon, description }) => {
              const isActive = accountType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAccountType(value)}
                  className={`
                    flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all
                    ${isActive
                      ? 'bg-accent-primary/10 border-accent-primary text-text-primary'
                      : 'bg-elevated border-border text-text-secondary hover:bg-card'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-accent-primary' : ''}`} />
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Currency and Opening Balance */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={CURRENCIES.map(c => ({ value: c, label: c }))}
          />
          <Input
            label="Opening Balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            className="mono"
            error={error && isNaN(parseFloat(openingBalance)) ? error : ''}
          />
        </div>

        {/* General API error (not tied to a specific field) */}
        {error && name.trim() && !isNaN(parseFloat(openingBalance)) && (
          <p className="text-sm text-accent-destructive">{error}</p>
        )}
      </div>
    </Modal>
  );
}
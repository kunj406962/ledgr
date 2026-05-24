/**
 * AccountHeader
 *
 * Shows account name, type, balance, and the three action buttons.
 * The "···" overflow menu reveals Edit Account and Delete Account.
 * Delete opens AccountDeleteModal.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, ArrowLeftRight, Upload, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AccountDeleteModal } from './AccountDeleteModal';
import type { Account } from '@/hooks/useAccountDetail';

interface AccountHeaderProps {
  account: Account;
  onAddTransaction: () => void;
  onTransfer: () => void;
  onDeleted: () => void; // called after successful delete → redirect
}

function parseFloat2(v: number | string): number {
  return parseFloat(String(v));
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  return `${val < 0 ? '-' : ''}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TYPE_LABEL: Record<string, string> = {
  chequing: 'Chequing',
  savings: 'Savings',
  investment: 'Investment',
  credit_card: 'Credit Card',
};

export function AccountHeader({
  account,
  onAddTransaction,
  onTransfer,
  onDeleted,
}: AccountHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const balance = parseFloat2(account.current_balance);
  const isNegative = balance < 0;
  const isCreditCard = account.type === 'credit_card';
  const balanceColor = isCreditCard
    ? 'text-accent-warning'
    : isNegative
    ? 'text-accent-destructive'
    : 'text-text-primary';

  return (
    <>
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm text-text-secondary mb-1">
              {TYPE_LABEL[account.type] ?? account.type} · {account.currency}
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-text-primary mb-3">
              {account.name}
            </h1>
            <div className={`mono text-4xl md:text-5xl font-semibold ${balanceColor}`}>
              {formatCurrency(balance)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              className="flex items-center gap-2"
              onClick={onAddTransaction}
            >
              <Plus className="w-4 h-4" />
              Add Transaction
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="flex items-center gap-2"
              onClick={onTransfer}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Transfer
            </Button>
            <Button variant="ghost" size="md" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import
            </Button>

            {/* Overflow menu */}
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-lg z-20 py-1"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-accent-destructive/10 text-accent-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AccountDeleteModal
        isOpen={deleteOpen}
        account={account}
        onClose={() => setDeleteOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  );
}
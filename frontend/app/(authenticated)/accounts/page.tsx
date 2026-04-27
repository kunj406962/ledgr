'use client';

/**
 * /app/(authenticated)/accounts/page.tsx
 *
 * All colors reference CSS variables from globals.css.
 * ThemeContext puts .dark or .light on <html>; var() resolves automatically.
 */

import { useState } from 'react';
import {
  Plus, Wallet, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useAccounts} from '@/hooks/useAccounts';
import { AccountCard } from '@/components/accounts/AccountCard';
import { Button } from '@/components/ui/Button';
import type { Account } from '@/hooks/useAccounts';
import NetWorthBanner from '@/components/accounts/NetworthBanner';
import { AddAccountModal } from '@/components/accounts/AddAccountModal';

type AccountType = Account['type'];
const TYPE_ORDER: AccountType[] = ['chequing', 'savings', 'investment', 'credit_card'];
const TYPE_LABELS: Record<AccountType, string> = {
  chequing:    'Chequing',
  savings:     'Savings',
  investment:  'Investment',
  credit_card: 'Credit Cards',
};

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl border p-5 animate-pulse"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="space-y-1.5 flex-1">
          <div className="h-2.5 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-3   w-28 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        </div>
      </div>
      <div className="h-8 w-32 rounded mb-4" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      <div className="h-10  rounded"          style={{ backgroundColor: 'var(--bg-elevated)' }} />
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="relative mb-6">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-muted)' }}
        >
          <Wallet className="w-12 h-12" style={{ color: 'var(--accent)' }} />
        </div>
        <div
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-2 flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <Plus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Add your first account
      </h2>
      <p className="max-w-sm mb-8 leading-relaxed text-sm" style={{ color: 'var(--text-secondary)' }}>
        Connect your chequing, savings, investment, or credit card accounts to get a unified view of your finances.
      </p>

      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-all duration-150 shadow-lg"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-base)' }}
      >
        <Plus className="w-4 h-4" />
        Add Account
      </button>
    </div>
  );
}


// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { accounts, loading, error, refetch } = useAccounts();
  const [modalOpen, setModalOpen] = useState(false);

  const grouped = TYPE_ORDER.reduce<Record<AccountType, Account[]>>(
    (acc, type) => ({ ...acc, [type]: [] }),
    {} as Record<AccountType, Account[]>
  );
  for (const account of accounts) {
    if (grouped[account.type]) grouped[account.type].push(account);
  }

  return (
    <>
      <div className="min-h-full pb-24 sm:pb-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Accounts
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Manage all your financial accounts
            </p>
          </div>
          <Button variant="primary" className="flex items-center gap-2" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Add Account</span>
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <div className="rounded-2xl border p-5 animate-pulse h-24" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="rounded-2xl border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ backgroundColor: 'var(--destructive-muted)', borderColor: 'var(--destructive)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--destructive-muted)' }}>
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--destructive)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-0.5" style={{ color: 'var(--destructive)' }}>Failed to load accounts</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            </div>
            <button
              onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
              style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && accounts.length === 0 && (
          <EmptyState onAdd={() => setModalOpen(true)} />
        )}

        {/* Populated */}
        {!loading && !error && accounts.length > 0 && (
          <div className="space-y-8">
            <NetWorthBanner accounts={accounts} />

            {TYPE_ORDER.filter((type) => grouped[type].length > 0).map((type) => (
              <section key={type}>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  {TYPE_LABELS[type]}
                  <span
                    className="text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                  >
                    {grouped[type].length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[type].map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              </section>
            ))}

            {/* Add another */}
            <button
              onClick={() => setModalOpen(true)}
              className="w-full rounded-2xl border border-dashed p-6 flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Add Another Account</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      {!loading && !error && accounts.length > 0 && (
        <button
          onClick={() => setModalOpen(true)}
          className="sm:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-base)' }}
          aria-label="Add account"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <AddAccountModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={refetch} />
    </>
  );
}
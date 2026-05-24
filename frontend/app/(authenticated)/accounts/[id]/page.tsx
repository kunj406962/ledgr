/**
 * /app/(authenticated)/accounts/[id]/page.tsx
 *
 * Thin orchestrator — all UI lives in ./components/.
 * This file only wires state, hooks, and layout.
 */

'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AddTransactionModal } from '@/components/accountDetails/AddTransactionModal';
import { TransferModal } from '@/components/accountDetails/TransferModal';
import { AccountHeader } from '@/components/accountDetails/AccountHeader';
import { BalanceChart } from '@/components/accountDetails/BalanceChart';
import { TransactionTable } from '@/components/accountDetails/TransactionTable';
import { useAccountDetail } from '@/hooks/useAccountDetail';
import type { Transaction } from '@/hooks/useAccountDetail';
import type { ChartPoint } from '@/components/accountDetails/BalanceChart';

type Filter = 'all' | 'in' | 'out';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function buildChartData(transactions: Transaction[], openingBalance: number): ChartPoint[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const sorted = [...transactions].sort(
    (a, b) => parseLocalDate(a.transaction_date).getTime() - parseLocalDate(b.transaction_date).getTime()
  );

  // Group by date — duplicate labels break Recharts tooltip
  const byDate = new Map<string, number>();
  for (const t of sorted) {
    byDate.set(t.transaction_date, (byDate.get(t.transaction_date) ?? 0) + parseFloat(String(t.amount)));
  }

  let running = Number(openingBalance);
  return Array.from(byDate.entries()).map(([date, delta]) => {
    running += delta;
    return {
      label: parseLocalDate(date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
      balance: Math.round(running * 100) / 100,
    };
  });
}

// ---------------------------------------------------------------------------
// Loading / Error sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-2xl bg-elevated" />
      <div className="h-72 rounded-2xl bg-elevated" />
      <div className="h-96 rounded-2xl bg-elevated" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-accent-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-accent-destructive" />
      </div>
      <h3 className="font-semibold text-text-primary mb-1">Something went wrong</h3>
      <p className="text-sm text-text-secondary mb-6 max-w-sm">{message}</p>
      <Button variant="ghost" size="sm" onClick={onRetry} className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [filter, setFilter] = useState<Filter>('all');
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const { account, transactions, allTransactions, loading, error, refetch } =
    useAccountDetail(accountId, filter);

  // Chart always uses the full unfiltered set
  const chartData = useMemo(
    () => buildChartData(allTransactions, account?.opening_balance ?? 0),
    [allTransactions, account]
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!account) {
    router.push('/accounts');
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        All Accounts
      </Link>

      <AccountHeader
        account={account}
        onAddTransaction={() => setAddTxOpen(true)}
        onTransfer={() => setTransferOpen(true)}
        onDeleted={() => router.push('/accounts')}
      />

      <BalanceChart data={chartData} />

      <TransactionTable
        transactions={transactions}
        filter={filter}
        onFilterChange={setFilter}
        onSuccess={refetch}
      />

      <AddTransactionModal
        isOpen={addTxOpen}
        onClose={() => setAddTxOpen(false)}
        accountId={account.id}
        accountName={account.name}
        onSuccess={refetch}
      />

      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        fromAccountId={account.id}
        onSuccess={refetch}
      />
    </div>
  );
}
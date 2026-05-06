/**
 * /app/(authenticated)/accounts/[id]/page.tsx
 */

'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { AddTransactionModal } from '../../../../components/accountDetails/AddTransactionModal';
import { TransferModal } from '../../../../components/accountDetails/TransferModal';
import {
  ArrowUpRight,
  Plus,
  ArrowLeftRight,
  Upload,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAccountDetail, Transaction } from '../../../../hooks/useAccountDetail';

type Filter = 'all' | 'in' | 'out';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a date string like "2025-01-15" as a LOCAL date (no timezone shift).
 * new Date("2025-01-15") is parsed as UTC midnight, which shifts to the
 * previous day in UTC-offset timezones. Splitting manually avoids that.
 */
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Builds a running-balance series sorted by date ascending.
 * - Sorts explicitly by date — never assumes API return order.
 * - Parses amount with parseFloat to handle Decimal-as-string from FastAPI.
 * - Uses parseLocalDate to avoid UTC timezone shifting dates.
 */
function buildChartData(
  transactions: Transaction[],
  openingBalance: number
): { label: string; balance: number }[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const sorted = [...transactions].sort(
    (a, b) => parseLocalDate(a.transaction_date).getTime() - parseLocalDate(b.transaction_date).getTime()
  );

  // Group by date — multiple transactions on the same day must be one chart point.
  // Without grouping, duplicate labels cause the Recharts tooltip to always show
  // the first point's value regardless of where you hover.
  const byDate = new Map<string, number>();
  for (const t of sorted) {
    byDate.set(
      t.transaction_date,
      (byDate.get(t.transaction_date) ?? 0) + parseFloat(String(t.amount))
    );
  }

  let running = Number(openingBalance);

  return Array.from(byDate.entries()).map(([date, delta]) => {
    running += delta;
    return {
      label: parseLocalDate(date).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
      }),
      balance: Math.round(running * 100) / 100,
    };
  });
}

/**
 * Best human-readable label for a transaction row.
 * Priority: merchant > description_raw > notes > category.
 * Transfer rows have merchant=null and description_raw=null so notes
 * (the user-entered transfer description) is shown instead of a dash.
 */
function transactionLabel(t: Transaction): string {
  return t.merchant ?? t.description_raw ?? t.notes ?? t.category;
}

function formatCurrency(val: number): string {
  return `${val < 0 ? '-' : ''}$${Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
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

/**
 * Wrapper that gives ResponsiveContainer an explicit pixel height.
 * ResponsiveContainer width="100%" height="100%" fails when the parent
 * has no computed height at paint time (height: -1 error). Giving the
 * wrapper a fixed pixel height via style avoids the race condition.
 */
function ChartWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: 256, minHeight: 256 }}>
      {children}
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
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const { account, transactions, allTransactions, loading, error, refetch, refetchTransactions } =
    useAccountDetail(accountId, filter);

  // Chart uses allTransactions (full set) so it doesn't shrink when a filter tab is active
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

  const isNegative = account.current_balance < 0;
  const isCreditCard = account.type === 'credit_card';
  const balanceColor = isCreditCard
    ? 'text-accent-warning'
    : isNegative
    ? 'text-accent-destructive'
    : 'text-text-primary';

  const typeLabel: Record<string, string> = {
    chequing: 'Chequing',
    savings: 'Savings',
    investment: 'Investment',
    credit_card: 'Credit Card',
  };

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

      {/* Header card */}
      <Card className="bg-elevated">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm text-text-secondary mb-1">
              {typeLabel[account.type] ?? account.type} · {account.currency}
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-text-primary mb-3">
              {account.name}
            </h1>
            <div className={`mono text-4xl md:text-5xl font-semibold ${balanceColor}`}>
              {formatCurrency(account.current_balance)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              className="flex items-center gap-2"
              onClick={() => setIsAddTransactionOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Add Transaction
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="flex items-center gap-2"
              onClick={() => setIsTransferOpen(true)}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Transfer
            </Button>
            <Button variant="ghost" size="md" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import
            </Button>
          </div>
        </div>
      </Card>

      {/* Balance history chart — only render with 2+ data points */}
      {chartData.length > 1 && (
        <Card>
          <h3 className="font-semibold text-text-primary mb-4">Balance History</h3>
          <ChartWrapper>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D68F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D68F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: 'var(--text-secondary)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: 'var(--text-secondary)' }}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1000
                      ? `$${(v / 1000).toFixed(1)}k`
                      : `$${v}`
                  }
                  width={60}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Balance']}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#00D68F"
                  strokeWidth={2}
                  fill="url(#balanceGradient)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Card>
      )}

      {/* Transactions table */}
      <Card padding={false}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">Transactions</h3>
          <div className="flex gap-2">
            {(['all', 'in', 'out'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'in' ? 'Income' : 'Expenses'}
              </Button>
            ))}
          </div>
        </div>

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-elevated">
                <tr>
                  {['Date', 'Description', 'Category', 'Amount'].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-xs uppercase tracking-wider text-text-secondary font-medium ${
                        h === 'Amount' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-elevated transition-colors">
                    <td className="px-6 py-4 text-sm mono text-text-secondary whitespace-nowrap">
                      {formatDate(t.transaction_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary max-w-xs truncate">
                      {transactionLabel(t)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={t.direction === 'in' ? 'income' : 'default'}>
                        {t.category}
                      </Badge>
                    </td>
                    <td
                      className={`px-6 py-4 text-sm mono text-right font-semibold whitespace-nowrap ${
                        t.direction === 'in'
                          ? 'text-accent-primary'
                          : 'text-accent-destructive'
                      }`}
                    >
                      {t.direction === 'in' ? '+' : ''}
                      {formatCurrency(parseFloat(String(t.amount)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-elevated mx-auto mb-4 flex items-center justify-center">
              <ArrowUpRight className="w-8 h-8 text-text-secondary" />
            </div>
            <h3 className="font-semibold text-text-primary mb-2">
              No{filter !== 'all' ? (filter === 'in' ? ' income' : ' expense') : ''}{' '}
              transactions
            </h3>
            <p className="text-sm text-text-secondary">
              {filter === 'all'
                ? 'This account has no transactions yet.'
                : `No ${filter === 'in' ? 'income' : 'expense'} transactions found.`}
            </p>
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddTransactionModal
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
        accountId={account.id}
        accountName={account.name}
        onSuccess={refetch}
      />
      {/* refetch updates both account balance AND transactions */}

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        fromAccountId={account.id}
        onSuccess={refetch}
      />
    </div>
  );
}
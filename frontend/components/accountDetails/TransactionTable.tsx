/**
 * TransactionTable
 *
 * Filter tabs (All / Income / Expenses) + transaction list.
 * Clicking any row opens TransactionModal for view/edit/delete.
 */

'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TransactionModal } from './TransactionModal';
import { TransferDeleteModal } from './TransferDeleteModal';
import type { Transaction } from '@/hooks/useAccountDetail';

type Filter = 'all' | 'in' | 'out';

interface TransactionTableProps {
  transactions: Transaction[];        // filtered set for the table
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  onSuccess: () => void;             // refetch after edit/delete
}

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(val: number | string): string {
  const n = parseFloat(String(val));
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function transactionLabel(t: Transaction): string {
  return t.merchant ?? t.description_raw ?? t.notes ?? t.category;
}

export function TransactionTable({
  transactions,
  filter,
  onFilterChange,
  onSuccess,
}: TransactionTableProps) {
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [transferToDelete, setTransferToDelete] = useState<Transaction | null>(null);

  return (
    <>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {/* Header + filter tabs */}
        <div
          className="p-6 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <h3 className="font-semibold text-text-primary">Transactions</h3>
          <div className="flex gap-2">
            {(['all', 'in', 'out'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onFilterChange(f)}
              >
                {f === 'all' ? 'All' : f === 'in' ? 'Income' : 'Expenses'}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
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
              <tbody>
                {transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t hover:bg-elevated transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => setSelected(t)}
                  >
                    <td className="px-6 py-4 text-sm mono text-text-secondary whitespace-nowrap">
                      {formatDate(t.transaction_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary max-w-xs truncate">
                      {transactionLabel(t)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          t.direction === 'in'
                            ? 'bg-accent-primary/10 text-accent-primary'
                            : 'bg-elevated text-text-secondary'
                        }`}
                      >
                        {t.category}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-sm mono text-right font-semibold whitespace-nowrap ${
                        t.direction === 'in'
                          ? 'text-accent-primary'
                          : 'text-accent-destructive'
                      }`}
                    >
                      {t.direction === 'in' ? '+' : ''}
                      {formatCurrency(t.amount)}
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
              No{filter !== 'all' ? (filter === 'in' ? ' income' : ' expense') : ''} transactions
            </h3>
            <p className="text-sm text-text-secondary">
              {filter === 'all'
                ? 'This account has no transactions yet.'
                : `No ${filter === 'in' ? 'income' : 'expense'} transactions found.`}
            </p>
          </div>
        )}
      </div>

      <TransactionModal
        isOpen={selected !== null}
        transaction={selected}
        onClose={() => setSelected(null)}
        onDeleteTransfer={(tx) => {
          setSelected(null);
          setTransferToDelete(tx);
        }}
        onSuccess={() => {
          setSelected(null);
          onSuccess();
        }}
      />

      <TransferDeleteModal
        isOpen={transferToDelete !== null}
        transaction={transferToDelete}
        onClose={() => setTransferToDelete(null)}
        onSuccess={() => {
          setTransferToDelete(null);
          onSuccess();
        }}
      />
    </>
  );
}
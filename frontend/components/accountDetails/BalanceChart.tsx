/**
 * BalanceChart
 *
 * 90-day balance history area chart using Recharts.
 * Only renders when chartData has 2+ points.
 *
 * Fixes applied:
 * - ChartWrapper with inline style height → fixes ResponsiveContainer -1 error
 * - parseLocalDate → fixes UTC timezone date shift
 * - parseFloat(String(amount)) → handles Decimal-as-string from FastAPI
 * - Group by date → fixes tooltip showing same value on all hover points
 */

'use client';

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface ChartPoint {
  label: string;
  balance: number;
}

interface BalanceChartProps {
  data: ChartPoint[];
}

function formatCurrency(val: number): string {
  return `${val < 0 ? '-' : ''}$${Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BalanceChart({ data }: BalanceChartProps) {
  if (data.length < 2) return null;

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <h3 className="font-semibold text-text-primary mb-4">Balance History</h3>

      {/* Inline style required — Tailwind h-* races during SSR hydration */}
      <div style={{ width: '100%', height: 256, minHeight: 256 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
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
              tick={{
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                fill: 'var(--text-secondary)',
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="var(--text-secondary)"
              tick={{
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                fill: 'var(--text-secondary)',
              }}
              tickFormatter={(v: number) =>
                Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
              }
              width={60}
            />
            <Tooltip
              formatter={(v) => [formatCurrency(v as number || 0), 'Balance']}
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
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
      </div>
    </div>
  );
}
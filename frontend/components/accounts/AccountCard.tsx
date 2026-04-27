'use client';

/**
 * AccountCard — displays a single account with balance and a sparkline trend.
 *
 * All colors read from CSS variables defined in globals.css.
 * ThemeContext toggles .dark / .light on <html>, which re-resolves every
 * var() automatically — no theme-specific logic is needed here.
 */

import Link from 'next/link';
import { CreditCard, PiggyBank, TrendingUp, Landmark } from 'lucide-react';
import { Sparkline } from './Sparkline';
import type { Account } from '@/hooks/useAccounts';
import { Card } from '../ui/Card';

interface AccountCardProps {
  account: Account;
  sparklineData?: number[];
}

const TYPE_META: Record<
  Account['type'],
  { label: string; Icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  chequing:    { label: 'Chequing',    Icon: Landmark,   iconBg: 'bg-blue-500/10',    iconColor: 'text-blue-500'    },
  savings:     { label: 'Savings',     Icon: PiggyBank,  iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
  investment:  { label: 'Investment',  Icon: TrendingUp, iconBg: 'bg-violet-500/10',  iconColor: 'text-violet-500'  },
  credit_card: { label: 'Credit Card', Icon: CreditCard, iconBg: 'bg-amber-500/10',   iconColor: 'text-amber-500'   },
};

export function AccountCard({ account, sparklineData }: AccountCardProps) {
  const meta = TYPE_META[account.type] ?? TYPE_META.chequing;
  const { Icon, label } = meta;

  const isNegative   = account.current_balance < 0;
  const color= isNegative ? '#FF5252' : '#00D68F';

  const fallback  = Array(7).fill(Math.abs(account.current_balance));
  const chartData = sparklineData && sparklineData.length > 1 ? sparklineData : fallback;

    return (
        <Link href={`/accounts/${account.id}`} className="block group focus:outline-none">
            <Card className="hover:border-accent-primary transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                    <div className='flex items-center gap-3 min-w-0'>
                        <div className={`w-9 h-9 rounded-full bg-accent-primary/10 flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 text-accent-primary`} />
                        </div>
                        <div className='min-w-0'>
                            <div className="text-sm text-text-secondary mb-1 uppercase">{label}</div>
                            <div className="font-semibold text-text-primary">{account.name}</div>
                        </div>
                    </div>
                </div>
                <div className={`mono text-2xl md:text-3xl font-semibold mb-4 ${isNegative ? 'text-accent-destructive' : 'text-text-primary'}`}>
                {isNegative ? '-' : ''}${Math.abs(account.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                
                <div className="h-10">
                <Sparkline data={chartData.map(Math.abs)} color={color} />
                </div>
                
                <div className="text-xs text-text-secondary mt-2">Last 7 days</div>
            </Card>
        </Link>
    );

}
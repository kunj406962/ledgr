import { Wallet } from "lucide-react";
import type { Account } from "@/hooks/useAccounts";
import { Card } from "../ui/Card";

export default function NetWorthBanner({ accounts }: { accounts: Account[] }) {
  const total      = accounts.reduce((sum, a) => sum + a.current_balance, 0);
    return (
       <Card>
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-8 h-8 text-accent-primary" />
                </div>
            <div>
                <div className="text-sm text-text-secondary mb-1">Total Net Worth</div>
                <div className="mono text-4xl md:text-5xl font-semibold text-text-primary">
                    ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                </div>
            </div>
            </div>
       </Card>
    );
}
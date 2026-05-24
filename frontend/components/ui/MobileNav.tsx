'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, TrendingUp, Upload, PieChart } from 'lucide-react';

export function MobileNav() {
  const pathname = usePathname();
  
  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { path: '/accounts', icon: Wallet, label: 'Accounts' },
    { path: '/insights', icon: TrendingUp, label: 'Insights' },
    { path: '/budgets', icon: PieChart, label: 'Budgets' },
    { path: '/import', icon: Upload, label: 'Import' },
  ];
  
  const isActive = (path: string) => {
    if (path === '/accounts') {
      return pathname === path || pathname?.startsWith('/account/');
    }
    return pathname === path;
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden">
      <nav className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors flex-1
                ${active 
                  ? 'text-accent-primary' 
                  : 'text-text-secondary'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
'use client';

import React from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function MobileHeader() {
  return (
    <div className="md:hidden sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <Link href="/dashboard" className="mono text-2xl font-bold text-accent-primary">
        LEDGR
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link 
          href="/settings"
          className="p-2 rounded-lg hover:bg-elevated transition-colors"
        >
          <Settings className="w-5 h-5 text-text-secondary" />
        </Link>
      </div>
    </div>
  );
}
'use client';

import { usePathname } from "next/navigation";
import { Wallet, TrendingUp, Upload, PieChart, Settings, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import Link from "next/link";

interface SidebarProps{
    collapsed?: boolean;
}

export function SideBar({ collapsed = false }: SidebarProps) {
    const pathname= usePathname();

    const navItems=[
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/accounts', icon: Wallet, label: 'Accounts' },
        { path: '/insights', icon: TrendingUp, label: 'Insights' },
        { path: '/budgets', icon: PieChart, label: 'Budgets' },
        { path: '/import', icon: Upload, label: 'Import' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ]

    const isActive = (path: string) => {
        if (path === '/accounts') {
        return pathname === path || pathname?.startsWith('/account/');
        }
        return pathname === path;
    }

    return(
        <div className={`${collapsed ? 'w-20' : 'w-64'} h-screen bg-card border-r border-border flex flex-col transition-all duration-300`}>
            {/* Logo */}
            <div className="p-6 border-b border-border">
                <Link href="/dashboard" className="flex items-center gap-2">
                <span className="mono text-2xl font-bold text-accent-primary">
                    {collapsed ? 'L' : 'LEDGR'}
                </span>
                </Link>
            </div>
            
            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                    <Link
                    key={item.path}
                    href={item.path}
                    className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                        ${active 
                        ? 'bg-accent-primary text-background' 
                        : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
                        }
                    `}
                    >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="font-medium">{item.label}</span>}
                    </Link>
                );
                })}
            </nav>
            
            {/* Theme Toggle */}
            <div className="p-4 border-t border-border">
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && <span className="text-sm text-text-secondary">Theme</span>}
                <ThemeToggle />
                </div>
            </div>
        </div>
    )

}
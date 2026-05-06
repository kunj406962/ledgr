import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'income' | 'expense' | 'warning';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-elevated text-text-secondary border-border',
    income: 'bg-accent-primary/10 text-accent-primary border-accent-primary/20',
    expense: 'bg-accent-destructive/10 text-accent-destructive border-accent-destructive/20',
    warning: 'bg-accent-warning/10 text-accent-warning border-accent-warning/20'
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

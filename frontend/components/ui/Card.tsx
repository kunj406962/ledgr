import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: boolean;
}

export function Card({ children, className = '', elevated = false, padding = true }: CardProps) {
  return (
    <div 
      className={`
        ${elevated ? 'bg-elevated' : 'bg-card'} 
        rounded-lg border border-border
        ${padding ? 'p-6' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-2.5 rounded-lg
          bg-elevated border border-border
          text-text-primary placeholder:text-text-secondary
          focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent
          transition-all duration-200
          ${error ? 'border-accent-destructive' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-xs text-accent-destructive">{error}</span>
      )}
    </div>
  );
}
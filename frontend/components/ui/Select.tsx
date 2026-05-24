import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-2.5 rounded-lg
          bg-elevated border border-border
          text-text-primary
          focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent
          transition-all duration-200
          ${className}
        `}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

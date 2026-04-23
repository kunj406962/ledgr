import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md',
  className = '',
  children,
  ...props 
}: ButtonProps) {
  const baseStyles = 'font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-accent-primary text-background hover:bg-accent-primary/90',
    secondary: 'bg-accent-secondary text-white hover:bg-accent-secondary/90',
    ghost: 'bg-transparent border border-border text-text-primary hover:bg-elevated',
    destructive: 'bg-accent-destructive text-white hover:bg-accent-destructive/90'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-lg'
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
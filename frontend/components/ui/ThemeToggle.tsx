import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-text-secondary" />
      ) : (
        <Moon className="w-5 h-5 text-text-secondary" />
      )}
    </button>
  );
}

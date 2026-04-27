import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-elevated transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-border bg-elevated">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

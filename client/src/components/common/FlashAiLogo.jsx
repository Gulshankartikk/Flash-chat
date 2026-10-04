import React from 'react';
import { Sparkles } from 'lucide-react';

export const FlashAiLogo = ({ size = 'md', showText = true, className = '' }) => {
  const sizeClasses = {
    sm: { box: 'w-6 h-6', icon: 'w-3.5 h-3.5', text: 'text-xs' },
    md: { box: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-sm' },
    lg: { box: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-lg' },
    xl: { box: 'w-16 h-16', icon: 'w-8 h-8', text: 'text-2xl' }
  };

  const current = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className={`${current.box} rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-soft flex-shrink-0`}>
        <Sparkles className={current.icon} />
      </div>
      {showText && (
        <span className={`font-bold tracking-tight bg-brand-gradient bg-clip-text text-transparent ${current.text}`}>
          Flash AI
        </span>
      )}
    </div>
  );
};

export default FlashAiLogo;

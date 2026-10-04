import React from 'react';
import { Sparkles } from 'lucide-react';

export const AiBadge = ({ size = 'sm', className = '' }) => {
  const sizeClasses = size === 'xs' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-0.5 gap-1';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full bg-gradient-to-r from-orange-500/15 to-pink-500/15 text-orange-600 dark:text-pink-400 border border-orange-200 dark:border-pink-900/40 select-none ${sizeClasses} ${className}`}
    >
      <Sparkles className="w-3 h-3 text-orange-500" />
      <span>AI</span>
    </span>
  );
};

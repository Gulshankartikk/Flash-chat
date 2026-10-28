import React from 'react';
import { Sparkles } from 'lucide-react';

export const AiBadge = ({ size = 'sm', className = '' }) => {
  const sizeClasses = size === 'xs' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-0.5 gap-1';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full bg-primary/15 text-primary border border-primary/30 select-none ${sizeClasses} ${className}`}
    >
      <Sparkles className="w-3 h-3 text-primary" />
      <span>AI</span>
    </span>
  );
};

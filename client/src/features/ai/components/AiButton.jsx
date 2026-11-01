import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export const AiButton = ({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'chip'
  size = 'md', // 'sm' | 'md' | 'lg'
  iconOnly = false,
  className = '',
  title = 'AI Assistant',
  ariaLabel = 'AI Assistant action'
}) => {
  const baseClasses =
    'relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none';

  const sizeClasses = {
    sm: iconOnly ? 'p-1.5 rounded-lg' : 'text-xs px-2.5 py-1.5 rounded-xl gap-1.5',
    md: iconOnly ? 'p-2 rounded-xl' : 'text-sm px-3.5 py-2 rounded-2xl gap-2',
    lg: iconOnly ? 'p-3 rounded-2xl' : 'text-base px-5 py-2.5 rounded-2xl gap-2.5'
  }[size];

  const variantClasses = {
    primary:
      'bg-brand-gradient text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 hover:brightness-105',
    secondary:
      'bg-cream text-ink border border-line hover:border-primary/50 hover:bg-primary/10',
    ghost:
      'text-primary hover:bg-primary/10',
    chip:
      'bg-card border border-line text-ink text-xs px-3 py-1.5 rounded-full hover:border-primary hover:text-primary shadow-sm'
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={ariaLabel}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <Sparkles className="w-4 h-4 text-current shrink-0" />
      )}
      {!iconOnly && <span>{children}</span>}
    </button>
  );
};

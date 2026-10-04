import React from 'react';

export const Badge = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'accent' | 'muted' | 'unread'
  size = 'md', // 'sm' | 'md'
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 min-w-[16px] h-4',
    md: 'text-xs px-2.5 py-0.5 min-w-[20px] h-5'
  };

  const variantClasses = {
    primary: 'bg-primary text-white',
    secondary: 'bg-secondary text-white',
    accent: 'bg-accent text-white font-bold',
    unread: 'bg-accent text-white font-bold shadow-sm',
    muted: 'bg-cream text-muted border border-line',
    outline: 'border border-line text-ink bg-card'
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-full ${
        sizeClasses[size] || sizeClasses.md
      } ${variantClasses[variant] || variantClasses.primary} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;

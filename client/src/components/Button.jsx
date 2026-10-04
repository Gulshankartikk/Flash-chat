import React from 'react';

export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  isLoading = false,
  disabled = false,
  className = '',
  icon: Icon,
  type = 'button',
  onClick,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition duration-150 select-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.97] motion-reduce:transform-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-2 min-h-[36px] gap-1.5',
    md: 'text-sm px-4 py-2.5 min-h-[44px] gap-2',
    lg: 'text-base px-6 py-3 min-h-[48px] gap-2.5'
  };

  const variantStyles = {
    primary:
      'bg-brand-gradient hover:opacity-95 text-white shadow-soft focus:ring-primary',
    secondary:
      'bg-card text-ink border border-line hover:bg-cream focus:ring-primary',
    outline:
      'border-2 border-primary text-primary hover:bg-cream focus:ring-primary',
    ghost:
      'text-muted hover:text-ink hover:bg-cream focus:ring-primary',
    danger:
      'bg-accent hover:opacity-95 text-white shadow-soft focus:ring-accent'
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${
        variantStyles[variant] || variantStyles.primary
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        React.isValidElement(Icon) ? (
          Icon
        ) : typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null) ? (
          <Icon className="w-4 h-4 flex-shrink-0" />
        ) : null
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default Button;

import React, { forwardRef } from 'react';

export const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      icon: Icon,
      rightElement,
      className = '',
      type = 'text',
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-ink mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {Icon && (
            <div className="absolute left-3.5 text-muted pointer-events-none flex items-center justify-center">
              {React.isValidElement(Icon) ? (
                Icon
              ) : typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null) ? (
                <Icon className="w-4 h-4" />
              ) : null}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={`w-full py-2.5 rounded-xl border text-sm transition text-ink placeholder-muted/70 bg-card focus:outline-none focus:ring-2 focus:ring-primary ${
              Icon ? 'pl-10' : 'pl-3.5'
            } ${rightElement ? 'pr-10' : 'pr-3.5'} ${
              error
                ? 'border-accent focus:ring-accent bg-accent/5'
                : 'border-line focus:border-primary bg-card'
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 text-muted">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-accent font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-[11px] text-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

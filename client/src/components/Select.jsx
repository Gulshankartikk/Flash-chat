import React, { forwardRef } from 'react';

export const Select = forwardRef(
  (
    {
      label,
      error,
      helperText,
      options = [],
      className = '',
      children,
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
        <select
          ref={ref}
          className={`w-full py-2.5 px-3.5 rounded-xl border text-sm transition text-ink bg-card focus:outline-none focus:ring-2 focus:ring-primary ${
            error
              ? 'border-accent focus:ring-accent bg-accent/5'
              : 'border-line focus:border-primary bg-card'
          } ${className}`}
          {...props}
        >
          {children ||
            options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label || opt.value}
              </option>
            ))}
        </select>
        {error ? (
          <p className="mt-1 text-xs text-accent font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-[11px] text-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;

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
          <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {Icon && (
            <div className="absolute left-3.5 text-[#6B7280] pointer-events-none">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={`w-full py-2.5 rounded-xl border text-sm transition text-[#1F2937] placeholder-[#6B7280]/60 bg-white focus:outline-none focus:ring-2 ${
              Icon ? 'pl-10' : 'pl-3.5'
            } ${rightElement ? 'pr-10' : 'pr-3.5'} ${
              error
                ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20'
                : 'border-[#FED7AA] focus:ring-[#F97316] bg-[#FFF7ED]/30 focus:bg-white'
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 text-[#6B7280]">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-[#F43F5E] font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-[11px] text-[#6B7280]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

import React from 'react';

export const Switch = ({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  className = ''
}) => {
  return (
    <label className={`flex items-center justify-between cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {(label || description) && (
        <div className="flex flex-col mr-3">
          {label && <span className="text-sm font-semibold text-ink">{label}</span>}
          {description && <span className="text-xs text-muted">{description}</span>}
        </div>
      )}
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out border border-line ${
            checked ? 'bg-primary' : 'bg-card'
          }`}
        />
        <div
          className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
            checked ? 'transform translate-x-5' : 'transform translate-x-0'
          }`}
        />
      </div>
    </label>
  );
};

export default Switch;

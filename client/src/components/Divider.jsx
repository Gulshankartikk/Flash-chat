import React from 'react';

export const Divider = ({ label, className = '' }) => {
  if (label) {
    return (
      <div className={`flex items-center my-4 ${className}`}>
        <div className="flex-grow border-t border-line" />
        <span className="flex-shrink mx-3 text-xs font-semibold text-muted uppercase tracking-wider">
          {label}
        </span>
        <div className="flex-grow border-t border-line" />
      </div>
    );
  }

  return <hr className={`border-t border-line my-3 ${className}`} />;
};

export default Divider;

import React, { useState } from 'react';

export const Tooltip = ({ content, children, position = 'top', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && content && (
        <div
          role="tooltip"
          className={`absolute z-50 whitespace-nowrap bg-ink text-white text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-soft pointer-events-none transition-opacity duration-150 ${
            positionStyles[position] || positionStyles.top
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;

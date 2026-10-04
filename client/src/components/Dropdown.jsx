import React, { useState, useRef, useEffect } from 'react';

export const Dropdown = ({
  trigger,
  children,
  align = 'right', // 'left' | 'right'
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 min-w-[180px] bg-card text-ink border border-line rounded-xl shadow-soft p-1.5 focus:outline-none ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const DropdownItem = ({
  children,
  onClick,
  icon: Icon,
  danger = false,
  className = ''
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition text-left cursor-pointer ${
        danger
          ? 'text-accent hover:bg-accent/10'
          : 'text-ink hover:bg-cream'
      } ${className}`}
    >
      {Icon && (
        React.isValidElement(Icon) ? (
          Icon
        ) : typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null) ? (
          <Icon className="w-4 h-4 flex-shrink-0" />
        ) : null
      )}
      <span>{children}</span>
    </button>
  );
};

export default Dropdown;

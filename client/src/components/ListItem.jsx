import React from 'react';

export const ListItem = ({
  left,
  title,
  subtitle,
  right,
  onClick,
  active = false,
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-3.5 rounded-xl transition select-none ${
        onClick ? 'cursor-pointer hover:bg-cream active:scale-[0.99] motion-reduce:transform-none' : ''
      } ${active ? 'bg-cream border-l-4 border-primary' : 'bg-card border border-line'} ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {left && <div className="flex-shrink-0">{left}</div>}
        <div className="flex flex-col min-w-0 flex-1">
          {typeof title === 'string' ? (
            <span className="text-sm font-semibold text-ink truncate">{title}</span>
          ) : (
            title
          )}
          {subtitle && (
            <span className="text-xs text-muted truncate mt-0.5">{subtitle}</span>
          )}
        </div>
      </div>
      {right && <div className="flex-shrink-0 ml-3">{right}</div>}
    </div>
  );
};

export default ListItem;

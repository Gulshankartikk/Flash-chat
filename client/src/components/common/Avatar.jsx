import React from 'react';

export const Avatar = React.memo(function Avatar({
  src,
  name = 'User',
  size = 'md',
  isOnline = false,
  showStatus = false,
  className = ''
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const statusSizeClasses = {
    sm: 'w-2.5 h-2.5 border',
    md: 'w-3 h-3 border-2',
    lg: 'w-3.5 h-3.5 border-2',
    xl: 'w-4 h-4 border-2'
  };

  const fallback = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          className={`${sizeClasses[size] || sizeClasses.md} rounded-full object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextSibling) {
              e.currentTarget.nextSibling.style.display = 'flex';
            }
          }}
        />
      ) : null}
      <div
        style={{ display: src ? 'none' : 'flex' }}
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-semibold items-center justify-center border border-indigo-200 dark:border-indigo-900 shadow-sm`}
      >
        {fallback}
      </div>

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-white dark:border-slate-900 ${
            statusSizeClasses[size] || statusSizeClasses.md
          } ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
});

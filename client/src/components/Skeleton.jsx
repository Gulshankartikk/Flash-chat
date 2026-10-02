import React from 'react';

export const Skeleton = ({ className = '', variant = 'text' }) => {
  const variantStyles = {
    text: 'h-4 w-full rounded-md',
    avatar: 'w-10 h-10 rounded-full flex-shrink-0',
    card: 'h-40 w-full rounded-2xl',
    button: 'h-10 w-28 rounded-xl',
    circle: 'rounded-full'
  };

  return (
    <div
      className={`animate-pulse bg-[#FED7AA]/40 dark:bg-slate-800 ${
        variantStyles[variant] || ''
      } ${className}`}
    />
  );
};

export default Skeleton;

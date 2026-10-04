import React from 'react';

export const Card = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'p-4',
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-card text-ink border border-line rounded-xl shadow-soft transition-all duration-150 ${
        hoverable ? 'hover:shadow-lg hover:border-primary/40 cursor-pointer active:scale-[0.99] motion-reduce:transform-none' : ''
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

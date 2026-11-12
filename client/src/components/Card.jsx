import React from 'react';

export const Card = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'p-5',
  variant = 'glass',
  ...props
}) => {
  const variantClass =
    variant === 'coral'
      ? 'coral-card'
      : variant === 'flat'
      ? 'bg-card text-ink border border-line rounded-2xl shadow-soft'
      : 'glass text-ink';

  return (
    <div
      onClick={onClick}
      className={`${variantClass} transition-all duration-200 ${
        hoverable
          ? 'hover:-translate-y-1 hover:shadow-xl cursor-pointer active:scale-[0.98] motion-reduce:transform-none'
          : ''
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

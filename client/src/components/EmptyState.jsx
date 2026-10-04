import React from 'react';
import { motion } from 'framer-motion';

export const EmptyState = ({
  icon: Icon,
  emoji = '⚡',
  title,
  description,
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-cream border border-line flex items-center justify-center text-3xl mb-4 shadow-soft">
        {Icon ? (
          React.isValidElement(Icon) ? (
            Icon
          ) : typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null) ? (
            <Icon className="w-8 h-8 text-primary" />
          ) : null
        ) : (
          <span>{emoji}</span>
        )}
      </div>

      <h3 className="text-lg font-bold text-ink tracking-tight mb-1.5">
        {title}
      </h3>

      <p className="text-xs text-muted leading-relaxed mb-5">
        {description}
      </p>

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-5 py-2 rounded-xl bg-brand-gradient hover:opacity-95 text-white text-xs font-semibold shadow-soft transition cursor-pointer active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;

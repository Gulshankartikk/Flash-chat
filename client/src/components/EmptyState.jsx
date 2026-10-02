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
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#FFF7ED] to-[#FED7AA]/50 border border-[#FED7AA] flex items-center justify-center text-3xl mb-4 shadow-sm">
        {Icon ? <Icon className="w-8 h-8 text-[#F97316]" /> : <span>{emoji}</span>}
      </div>

      <h3 className="text-lg font-bold text-[#1F2937] tracking-tight mb-1.5">
        {title}
      </h3>

      <p className="text-xs text-[#6B7280] leading-relaxed mb-5">
        {description}
      </p>

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white text-xs font-semibold shadow-md shadow-orange-500/25 transition cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;

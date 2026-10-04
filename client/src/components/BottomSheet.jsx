import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export const BottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = 'max-h-[85vh]',
  showClose = true
}) => {
  const sheetRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/50 backdrop-blur-sm"
          />

          {/* Sheet Container */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`relative z-10 w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-line shadow-soft flex flex-col ${maxHeight} overflow-hidden`}
          >
            {/* Grab Handle bar for mobile drag feel */}
            <div className="w-full flex items-center justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-line" />
            </div>

            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
                <h3 className="text-sm font-bold text-ink">{title || ''}</h3>
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-full text-muted hover:text-ink hover:bg-cream transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Close sheet"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;

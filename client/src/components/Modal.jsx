import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  showClose = true
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/50 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            className={`relative w-full ${maxWidth} bg-card rounded-2xl p-6 shadow-soft border border-line z-10 overflow-hidden max-h-[90vh] flex flex-col`}
          >
            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4 flex-shrink-0">
                {title && (
                  <h3 className="text-lg font-bold text-ink tracking-tight">
                    {title}
                  </h3>
                )}
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-cream transition ml-auto focus:outline-none focus:ring-2 focus:ring-primary"
                    title="Close"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content body */}
            <div className="overflow-y-auto flex-1 pr-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl shadow-xl border text-xs font-medium backdrop-blur-md ${
                t.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-800'
                  : t.type === 'error'
                  ? 'bg-rose-50/95 border-rose-300 text-[#F43F5E]'
                  : 'bg-white/95 border-[#FED7AA] text-[#1F2937]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                {t.type === 'error' && <AlertCircle className="w-4 h-4 text-[#F43F5E] flex-shrink-0" />}
                {t.type === 'info' && <Info className="w-4 h-4 text-[#F97316] flex-shrink-0" />}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-full hover:bg-black/5 transition text-inherit ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return graceful fallback if provider isn't wrapping
    return {
      success: (msg) => console.log('Toast [success]:', msg),
      error: (msg) => console.error('Toast [error]:', msg),
      info: (msg) => console.info('Toast [info]:', msg)
    };
  }
  return context;
};

export default ToastProvider;

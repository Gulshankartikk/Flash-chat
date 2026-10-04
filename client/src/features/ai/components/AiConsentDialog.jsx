import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ShieldCheck, X } from 'lucide-react';
import { useAiStore } from '../store/useAiStore';

export const AiConsentDialog = ({ isOpen, onClose, onAccept }) => {
  const setConsentAccepted = useAiStore((s) => s.setConsentAccepted);

  const handleAgree = () => {
    localStorage.setItem('flash_ai_consent', 'true');
    setConsentAccepted(true);
    if (onAccept) onAccept();
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md p-6 bg-card dark:bg-zinc-900 rounded-3xl shadow-2xl border border-line dark:border-zinc-800"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-muted hover:text-ink dark:hover:text-cream rounded-full hover:bg-cream dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary via-secondary to-accent text-white shadow-lg shadow-primary/25">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink dark:text-cream">Welcome to Flash AI</h3>
              <p className="text-xs text-muted">Powered by Google Gemini</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-ink/80 dark:text-zinc-300 leading-relaxed mb-6">
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-cream dark:bg-zinc-800/60 border border-line dark:border-zinc-700/60">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Your Privacy First:</strong> Flash AI only processes content you explicitly choose to summarize, translate, rewrite, or ask about.
              </span>
            </div>

            <p>
              When using AI features, the selected text or media is securely sent to Google Gemini to generate intelligent assistance.
            </p>

            <p className="text-muted">
              You can toggle AI features, chat assistance, or Pocket vault permissions anytime in <strong>Settings &gt; Privacy</strong>.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-2xl text-xs font-semibold text-muted hover:text-ink dark:hover:text-cream border border-line dark:border-zinc-700 hover:bg-cream dark:hover:bg-zinc-800 transition-colors"
            >
              Not Now
            </button>
            <button
              type="button"
              onClick={handleAgree}
              className="flex-1 py-2.5 px-4 rounded-2xl text-xs font-semibold text-white bg-gradient-to-r from-primary to-secondary hover:brightness-105 shadow-md shadow-primary/25 transition-all"
            >
              Get Started
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

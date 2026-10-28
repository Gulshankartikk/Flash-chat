import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Bookmark, RefreshCw, Sparkles, Send } from 'lucide-react';
import { AiBadge } from './AiBadge';
import { AiThinking } from './AiThinking';
import { AiMarkdown } from './AiMarkdown';
import { AiErrorState } from './AiErrorState';
import { saveAiAnswerToPocket } from '../../pocket/hooks/useSaveToPocket';

export const AiSheet = ({
  isOpen,
  onClose,
  title = 'Flash AI Result',
  subtitle = 'Flash AI Assistant',
  content = '',
  loading = false,
  error = null,
  onRegenerate,
  onUse,
  useButtonLabel = 'Use this',
  prompt = ''
}) => {
  const [copied, setCopied] = useState(false);
  const [savingPocket, setSavingPocket] = useState(false);
  const [pocketSaved, setPocketSaved] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    try {
      const textToCopy = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleSaveToPocket = async () => {
    if (!content || pocketSaved || savingPocket) return;
    try {
      setSavingPocket(true);
      const textToSave = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await saveAiAnswerToPocket({
        text: textToSave,
        prompt: prompt || title,
        model: 'gemini'
      });
      setPocketSaved(true);
      setTimeout(() => setPocketSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save AI answer to Pocket', err);
    } finally {
      setSavingPocket(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-card dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-line dark:border-zinc-800 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-line dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <AiBadge />
              <div>
                <h3 className="font-bold text-ink dark:text-cream text-sm">{title}</h3>
                <p className="text-[11px] text-muted">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-muted hover:text-ink dark:hover:text-cream hover:bg-cream dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <AiThinking label="Generating intelligent response..." />
              </div>
            ) : error ? (
              <AiErrorState error={error} onRetry={onRegenerate} />
            ) : content ? (
              <div className="p-4 rounded-2xl bg-cream/70 dark:bg-zinc-800/60 border border-line dark:border-zinc-700/60">
                {typeof content === 'string' ? (
                  <AiMarkdown content={content} />
                ) : (
                  <pre className="text-xs whitespace-pre-wrap font-mono text-ink dark:text-zinc-200">
                    {JSON.stringify(content, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted">No content available.</div>
            )}
          </div>

          {/* Action Bar */}
          {!loading && !error && content && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-cream/40 dark:bg-zinc-800/40 border-t border-line dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-card dark:bg-card border border-line text-ink hover:bg-cream transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-primary" />
                      <span className="text-primary">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveToPocket}
                  disabled={savingPocket || pocketSaved}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-card dark:bg-zinc-800 border border-line dark:border-zinc-700 text-ink dark:text-cream hover:bg-primary/10 transition-colors disabled:opacity-60"
                  title="Save to Pocket"
                >
                  {pocketSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-secondary" />
                      <span className="text-secondary font-semibold">Saved to Pocket</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5 text-primary" />
                      <span>{savingPocket ? 'Saving...' : 'Save to Pocket'}</span>
                    </>
                  )}
                </button>

                {onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="p-2 rounded-xl text-muted hover:text-ink dark:hover:text-cream hover:bg-card dark:hover:bg-zinc-800 border border-line dark:border-zinc-700 transition-colors"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {onUse && (
                <button
                  type="button"
                  onClick={onUse}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-primary to-secondary hover:brightness-105 shadow-md shadow-primary/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{useButtonLabel}</span>
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

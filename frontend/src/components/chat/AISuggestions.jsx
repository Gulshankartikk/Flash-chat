import React from "react";
import { Sparkles, X, RotateCw, Send } from "lucide-react";

/**
 * AISuggestions renders contextual smart-reply suggestions right below the chat input,
 * matching the design:
 * │                      ├──────────────────────────────────────┤
 * │                      │ 😊  📎  🎤   Type message...     ➤   │
 * │                      │       ✨ AI Suggestions              │
 * └──────────────────────┴──────────────────────────────────────┘
 */
const AISuggestions = ({
  suggestions = [],
  isLoading = false,
  onSelectSuggestion,
  onQuickSend,
  onRefresh,
  onDismiss,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="px-4 pb-2.5 pt-0.5 w-full transition-all duration-200 animate-fade-in">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {/* Header Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 text-xs font-semibold flex-shrink-0 border border-amber-500/20 shadow-xs">
          <Sparkles size={13} className="animate-pulse text-amber-500" />
          <span>AI Suggestions</span>
        </div>

        {/* Suggestion Pills */}
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-gray-400 px-2">
            <RotateCw size={12} className="animate-spin text-amber-500" />
            <span>Generating suggestions...</span>
          </div>
        ) : (
          suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectSuggestion && onSelectSuggestion(suggestion)}
              title="Click to insert into message"
              className="px-3 py-1.5 text-xs rounded-full bg-white dark:bg-[#1a1a1a] hover:bg-amber-50/80 dark:hover:bg-[#262626] border border-slate-200 dark:border-[#2a2a2a] hover:border-amber-400/70 dark:hover:border-amber-500/60 text-slate-700 dark:text-slate-200 flex-shrink-0 transition-all shadow-xs flex items-center gap-2 group cursor-pointer"
            >
              <span className="font-normal truncate max-w-[280px]">"{suggestion}"</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (onQuickSend) onQuickSend(suggestion);
                }}
                title="Send immediately"
                className="opacity-0 group-hover:opacity-100 p-1 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-full transition-all flex items-center justify-center"
              >
                <Send size={9} />
              </span>
            </button>
          ))
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh suggestions"
              className="p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-full hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
            >
              <RotateCw size={12} className={isLoading ? "animate-spin" : ""} />
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              title="Dismiss suggestions"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISuggestions;

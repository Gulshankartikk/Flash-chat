import React from "react";
import { Pin, X } from "lucide-react";

const PinnedBanner = ({ pinnedMessage, onUnpin, onScrollTo }) => {
  if (!pinnedMessage) return null;

  return (
    <div
      onClick={onScrollTo}
      className="flex items-center justify-between px-4 py-2 bg-[#FF6B00]/10 dark:bg-[#FF6B00]/15 border-b border-[#FF6B00]/20 cursor-pointer hover:bg-[#FF6B00]/20 transition-colors animate-fade-in text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Pin size={14} className="text-[#FF6B00] flex-shrink-0 fill-current" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#FF6B00] truncate">
            Pinned Message • {pinnedMessage.sender?.username || "Someone"}
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-200 truncate">
            {pinnedMessage.content || (pinnedMessage.contentType === "audio" ? "🎵 Voice note" : "📎 Attachment")}
          </p>
        </div>
      </div>

      {onUnpin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnpin(pinnedMessage);
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          title="Unpin message"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default PinnedBanner;

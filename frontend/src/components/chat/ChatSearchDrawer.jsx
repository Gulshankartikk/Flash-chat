import React, { useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

const ChatSearchDrawer = ({ isOpen, onClose, onSearch, matchCount = 0, currentIndex = 0, onNext, onPrev }) => {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    onSearch(q);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-[#1c1c1c] border-b border-slate-200 dark:border-[#222222] shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <Search size={14} className="text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search in conversation..."
          autoFocus
          className="w-full bg-transparent text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none"
        />
        {query && (
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            {matchCount > 0 ? `${currentIndex + 1} of ${matchCount}` : "0 results"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {matchCount > 0 && (
          <>
            <button
              onClick={onPrev}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              title="Previous match"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onNext}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              title="Next match"
            >
              <ChevronDown size={16} />
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors ml-2"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default ChatSearchDrawer;

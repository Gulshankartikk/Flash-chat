import React, { useState, useEffect } from "react";
import { Sparkles, X, Copy, Check, RefreshCw } from "lucide-react";
import axiosInstance from "../../services/url.services";
import { toast } from "react-toastify";

const AISummaryModal = ({ isOpen, onClose, conversationId }) => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchSummary = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post("/chat/ai/summarize", {
        conversationId,
      });
      setSummary(res?.data?.data?.summary || "No summary available.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate AI summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success("Summary copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#222222]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-[#FF6B00] to-[#FFD166] text-white">
              <Sparkles size={16} />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-[#FFFFFF]">
              AI Thread Summary
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-left">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={24} className="animate-spin text-[#FF6B00]" />
              <p className="text-xs text-slate-400 font-medium">
                Flash AI is analyzing recent messages...
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151515] border border-slate-100 dark:border-[#2a2a2a] text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-[#222222] bg-slate-50 dark:bg-[#151515] flex gap-3">
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-[#FFFFFF] text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Regenerate
          </button>
          <button
            onClick={handleCopy}
            disabled={loading || !summary}
            className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold transition-all shadow-md shadow-[#FF6B00]/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy Summary"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISummaryModal;

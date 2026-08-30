import React, { useState } from "react";
import { MessageSquare, Users, Calendar, X, ShieldCheck } from "lucide-react";

const BackupPreviewModal = ({ isOpen, onClose, backupData, onConfirmRestore, isRestoring }) => {
  const [mergeStrategy, setMergeStrategy] = useState("merge"); // "merge" | "overwrite"

  if (!isOpen || !backupData) return null;

  const convCount = backupData.conversations?.length || 0;
  const msgCount = backupData.messages?.length || 0;
  const exportDate = backupData.exportedAt
    ? new Date(backupData.exportedAt).toLocaleString()
    : "Unknown Date";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#222222]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#FF6B00]" />
            <h2 className="text-base font-bold text-slate-800 dark:text-[#FFFFFF]">Restore Backup Preview</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-left">
          <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">
            Review your backup details below before applying changes to your Flash Chat account.
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-100 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#151515] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#FF6B00]/10 text-[#FF6B00]">
                <Users size={16} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Conversations</p>
                <p className="text-base font-bold text-slate-800 dark:text-white">{convCount}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#151515] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <MessageSquare size={16} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Messages</p>
                <p className="text-base font-bold text-slate-800 dark:text-white">{msgCount}</p>
              </div>
            </div>
          </div>

          {/* Date info */}
          <div className="p-3 rounded-xl border border-slate-100 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#151515] flex items-center gap-2.5 text-xs text-slate-600 dark:text-[#A0A0A0]">
            <Calendar size={15} className="text-[#FF6B00]" />
            <span>Exported on: <strong className="text-slate-800 dark:text-white">{exportDate}</strong></span>
          </div>

          {/* Merge Strategy Options */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-slate-700 dark:text-white">Restore Strategy:</p>
            <div className="space-y-2">
              <label
                onClick={() => setMergeStrategy("merge")}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  mergeStrategy === "merge"
                    ? "border-[#FF6B00] bg-[#FF6B00]/5 text-slate-800 dark:text-white"
                    : "border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="mergeStrategy"
                  checked={mergeStrategy === "merge"}
                  onChange={() => setMergeStrategy("merge")}
                  className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
                />
                <div className="text-xs">
                  <p className="font-bold">Merge with existing chats (Recommended)</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Preserves newer messages while restoring missing chat history and conversations.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setMergeStrategy("overwrite")}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  mergeStrategy === "overwrite"
                    ? "border-[#FF6B00] bg-[#FF6B00]/5 text-slate-800 dark:text-white"
                    : "border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="mergeStrategy"
                  checked={mergeStrategy === "overwrite"}
                  onChange={() => setMergeStrategy("overwrite")}
                  className="mt-0.5 text-[#FF6B00] focus:ring-[#FF6B00]"
                />
                <div className="text-xs">
                  <p className="font-bold">Replace all conversations</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Syncs exact state from this backup file.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-[#222222] bg-slate-50 dark:bg-[#151515] flex gap-3">
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-[#FFFFFF] text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmRestore(mergeStrategy)}
            disabled={isRestoring}
            className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-bold transition-all shadow-md shadow-[#FF6B00]/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isRestoring ? "Restoring..." : "Confirm & Restore"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupPreviewModal;

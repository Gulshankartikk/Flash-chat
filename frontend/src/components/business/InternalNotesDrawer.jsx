import React, { useState } from "react";
import { X, StickyNote, Send, Lock } from "lucide-react";
import useBusinessStore from "../../store/useBusinessStore";
import { formatTime } from "../../utils/formatTime";

const InternalNotesDrawer = ({ isOpen, onClose, ticket }) => {
  const [newNoteText, setNewNoteText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const addInternalNote = useBusinessStore((s) => s.addInternalNote);

  if (!isOpen || !ticket) return null;

  const notes = ticket.internalNotes || [];

  const handlePostNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setIsPosting(true);
    const added = await addInternalNote(ticket._id, newNoteText.trim());
    setIsPosting(false);

    if (added) {
      setNewNoteText("");
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-white dark:bg-[#161616] border-l border-slate-200 dark:border-[#262626] shadow-2xl flex flex-col animate-slideLeft">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-[#222222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <StickyNote size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
              Internal Team Notes <Lock size={10} className="text-amber-500" />
            </h3>
            <p className="text-[10px] text-slate-400">Invisible to customer</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#222222]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notes.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <StickyNote size={28} className="mx-auto mb-2 opacity-30 text-amber-500" />
            <p className="text-xs font-semibold">No internal notes yet</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Add private notes for teammates handling this ticket.
            </p>
          </div>
        ) : (
          notes.map((note, index) => (
            <div
              key={index}
              className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                <span>{note.author?.displayName || note.author?.username || "Teammate"}</span>
                <span>{note.createdAt ? formatTime(note.createdAt) : ""}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {note.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* New Note Composer */}
      <form onSubmit={handlePostNote} className="p-3 border-t border-slate-100 dark:border-[#222222]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Add internal note..."
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1c1c1c] text-slate-800 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="submit"
            disabled={isPosting || !newNoteText.trim()}
            className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-50 transition-transform active:scale-95"
            title="Post note"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default InternalNotesDrawer;

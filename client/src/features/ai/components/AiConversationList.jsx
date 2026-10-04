import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Pin, Trash2, Edit2, Check, X, Sparkles } from 'lucide-react';

export const AiConversationList = ({
  conversations = [],
  activeId = null,
  onSelect,
  onNewChat,
  onRename,
  onPin,
  onDelete,
  loading = false,
  className = ''
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const filtered = conversations.filter((c) =>
    (c.title || 'New Chat').toLowerCase().includes(search.toLowerCase())
  );

  const startRename = (c, e) => {
    e.stopPropagation();
    setEditingId(c._id);
    setEditTitle(c.title || 'New Chat');
  };

  const saveRename = (cId, e) => {
    e.stopPropagation();
    if (editTitle.trim() && onRename) {
      onRename(cId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const confirmDelete = (cId, e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(cId);
    }
    setDeletingId(null);
  };

  return (
    <div className={`flex flex-col h-full bg-card dark:bg-zinc-900 border-r border-line dark:border-zinc-800 ${className}`}>
      {/* Header & New Chat Button */}
      <div className="p-4 border-b border-line dark:border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-xs shadow-md shadow-primary/25 hover:brightness-105 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-cream dark:bg-zinc-800 border border-line dark:border-zinc-700 text-xs text-ink dark:text-cream placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted">Loading conversations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted flex flex-col items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary/40" />
            <span>{search ? 'No matches found.' : 'No AI chats yet. Start a new conversation!'}</span>
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = String(c._id) === String(activeId);
            const isEditing = editingId === c._id;
            const isDeleting = deletingId === c._id;

            return (
              <div
                key={c._id}
                onClick={() => !isEditing && onSelect && onSelect(c._id)}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                  isActive
                    ? 'bg-orange-500/10 text-primary dark:text-pink-400 font-semibold border border-primary/20 dark:border-pink-500/20'
                    : 'text-ink/80 dark:text-zinc-300 hover:bg-cream dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`} />

                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-2 py-0.5 rounded bg-card dark:bg-zinc-800 border border-primary text-xs focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(c._id, e);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => saveRename(c._id, e)}
                        className="p-1 text-primary hover:bg-cream rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="p-1 text-accent hover:bg-cream rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="truncate flex-1">{c.title || 'New Chat'}</span>
                  )}
                </div>

                {/* Actions */}
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Pin button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPin && onPin(c._id, !c.isPinned);
                      }}
                      className={`p-1 rounded hover:bg-line/40 ${
                        c.isPinned ? 'text-primary opacity-100' : 'text-muted'
                      }`}
                      title={c.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className="w-3 h-3" />
                    </button>

                    {/* Rename button */}
                    <button
                      type="button"
                      onClick={(e) => startRename(c, e)}
                      className="p-1 rounded text-muted hover:text-ink dark:hover:text-cream hover:bg-line/40"
                      title="Rename"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete button */}
                    {isDeleting ? (
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => confirmDelete(c._id, e)}
                          className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold"
                          title="Confirm Delete"
                        >
                          Del
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(null);
                          }}
                          className="p-1 text-muted hover:text-ink"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(c._id);
                        }}
                        className="p-1 rounded text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

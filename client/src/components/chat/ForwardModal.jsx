import React, { useState, useMemo } from 'react';
import { Search, X, Check, Send, Forward } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Button } from '../Button';

export const ForwardModal = ({
  isOpen,
  onClose,
  message,
  conversations = [],
  onForward
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations.filter((c) => c.status !== 'request');
    return conversations.filter((c) => {
      if (c.status === 'request') return false;
      const title = c.contactName || c.displayName || c.name || '';
      return title.toLowerCase().includes(q);
    });
  }, [conversations, search]);

  if (!isOpen || !message) return null;

  const toggleSelect = (convId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      return next;
    });
  };

  const handleConfirmForward = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsSubmitting(true);
      await onForward(message._id, Array.from(selectedIds));
      setSelectedIds(new Set());
      setSearch('');
      onClose();
    } catch (err) {
      console.error('Failed to forward message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewSnippet =
    message.text ||
    (message.media?.length ? `[${message.media[0].type || 'Attachment'}]` : 'Forwarded message');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-card rounded-2xl border border-line shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cream text-primary flex items-center justify-center">
              <Forward className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Forward message</h3>
              <p className="text-[11px] text-muted truncate max-w-[240px]">
                "{previewSnippet.slice(0, 35)}
                {previewSnippet.length > 35 ? '...' : ''}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-cream text-muted hover:text-ink transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-line">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Search chat or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-line bg-cream/50 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-line/30 p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedIds.has(conv._id);
              const title = conv.contactName || conv.displayName || conv.name || 'Chat';
              return (
                <div
                  key={conv._id}
                  onClick={() => toggleSelect(conv._id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                    isSelected ? 'bg-cream text-primary font-bold' : 'hover:bg-cream/50 text-ink'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={conv.displayAvatar || conv.otherUser?.avatar}
                      name={title}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{title}</p>
                      <p className="text-[10px] text-muted truncate">
                        {conv.type === 'group'
                          ? `${conv.members?.length || 0} participants`
                          : `@${conv.otherUser?.username || 'user'}`}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-primary border-primary text-white shadow-xs'
                        : 'border-line bg-card'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-line flex items-center justify-between bg-card">
          <span className="text-xs text-muted font-medium">
            {selectedIds.size} chat{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              disabled={selectedIds.size === 0 || isSubmitting}
              onClick={handleConfirmForward}
            >
              {isSubmitting ? 'Forwarding...' : 'Forward'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Check,
  Send,
  Link2,
  Bookmark,
  Flag,
  Share2,
  Users,
  MessageCircle,
  X
} from 'lucide-react';
import { useSocialStore } from '../store/useSocialStore';
import { BottomSheet } from '../../../components/BottomSheet';
import { SocialAvatar } from './SocialAvatar';
import { fetchShareSuggestions, shareContentApi } from '../api/api';

export const ShareSheet = () => {
  const navigate = useNavigate();
  const { shareSheet, closeShareSheet } = useSocialStore();
  const { isOpen, contentType, contentId, snapshot } = shareSheet;

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]); // conversation IDs (or user IDs to convert)
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentToast, setSentToast] = useState(null); // { message, conversationId }

  // Load suggestions from API
  const loadSuggestions = useCallback(async (q = '') => {
    try {
      setLoading(true);
      const res = await fetchShareSuggestions(q);
      if (res.success) {
        setSuggestions(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load share suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setNoteText('');
      setSearchQuery('');
      setSentToast(null);
      loadSuggestions('');
    }
  }, [isOpen, loadSuggestions]);

  // Debounce search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadSuggestions(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, loadSuggestions]);

  // Toggle selection (max 10)
  const toggleSelect = (item) => {
    const id = item.id;
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } else {
      if (selectedIds.length >= 10) {
        alert('You can share to up to 10 chats at a time.');
        return;
      }
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  // Send share
  const handleSend = async () => {
    if (selectedIds.length === 0 || isSending) return;
    setIsSending(true);

    try {
      const res = await shareContentApi({
        kind: contentType,
        refId: contentId,
        conversationIds: selectedIds,
        text: noteText.trim()
      });

      if (res.success) {
        const count = selectedIds.length;
        const firstConvId = selectedIds[0];
        setSentToast({
          message: `Sent to ${count} ${count === 1 ? 'chat' : 'chats'}!`,
          conversationId: count === 1 ? firstConvId : null
        });

        setTimeout(() => {
          closeShareSheet();
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to share content:', err);
      alert(err.response?.data?.message || 'Failed to share content.');
    } finally {
      setIsSending(false);
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    let url = window.location.origin;
    if (contentType === 'post') url += `/social/post/${contentId}`;
    else if (contentType === 'reel') url += `/social/reels`;
    else if (contentType === 'profile') url += `/u/${snapshot?.authorUsername || contentId}`;
    else url += `/social`;

    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  // Native Web Share
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Flash Chat',
          text: `Check out this ${contentType} on Flash Chat!`,
          url: window.location.href
        });
      } catch (e) {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={closeShareSheet} title="Share to Direct Chat">
      <div className="flex flex-col h-[75vh] sm:h-[65vh] bg-white">
        {/* Search input */}
        <div className="p-3 border-b border-[#FED7AA]/50">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#FFF7ED] border border-[#FED7AA]">
            <Search className="w-3.5 h-3.5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recent chats or people..."
              className="w-full text-xs text-[#1F2937] bg-transparent focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#6B7280] hover:text-[#1F2937]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Suggestions Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-[#FED7AA]/40" />
                  <div className="w-12 h-2.5 rounded-full bg-[#FED7AA]/30" />
                </div>
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6B7280]">
              <Users className="w-10 h-10 stroke-1 text-[#FED7AA] mb-2" />
              <p className="text-xs font-bold text-[#1F2937]">No recipients found</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Start conversations in Chats to share here!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {suggestions.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group select-none text-center"
                  >
                    <div className="relative">
                      <SocialAvatar
                        src={item.avatar}
                        alt={item.name}
                        size="md"
                        className={isSelected ? 'scale-105 transition-transform' : ''}
                      />
                      {/* Check badge */}
                      <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white text-white transition ${
                          isSelected
                            ? 'bg-[#F97316] scale-110 shadow-xs'
                            : 'bg-black/20 group-hover:bg-black/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#1F2937] truncate max-w-[68px]">
                      {item.name || item.username}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Optional note + Send action */}
        <div className="p-3 border-t border-[#FED7AA]/60 bg-[#FFF7ED]/30 space-y-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 px-4 py-2 rounded-full border border-[#FED7AA] bg-white text-xs text-[#1F2937] focus:outline-hidden focus:border-[#F97316]"
              />
              <button
                type="button"
                disabled={isSending}
                onClick={handleSend}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-md shadow-orange-500/15 hover:opacity-95 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send ({selectedIds.length})</span>
              </button>
            </div>
          )}

          {/* Quick Actions Row */}
          <div className="flex items-center justify-around pt-2 border-t border-[#FED7AA]/40 text-xs font-semibold text-[#1F2937]">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 hover:text-[#F97316] transition cursor-pointer"
            >
              <Link2 className="w-4 h-4 text-[#F97316]" />
              <span>Copy Link</span>
            </button>

            {/* Add to Pocket: Placeholder for Step 7 */}
            <button
              type="button"
              disabled
              title="Coming in Step 7: Pocket Vault"
              className="flex items-center gap-1.5 text-[#6B7280] opacity-60 cursor-not-allowed"
            >
              <Bookmark className="w-4 h-4" />
              <span>Add to Pocket</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="flex items-center gap-1.5 hover:text-[#EC4899] transition cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#EC4899]" />
              <span>Share Via...</span>
            </button>
          </div>
        </div>

        {/* Sent Confirmation Toast */}
        {sentToast && (
          <div className="p-3 bg-emerald-500 text-white flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
            <span>{sentToast.message}</span>
            {sentToast.conversationId && (
              <button
                type="button"
                onClick={() => {
                  closeShareSheet();
                  navigate(`/chats/${sentToast.conversationId}`);
                }}
                className="underline hover:opacity-90 cursor-pointer"
              >
                Open chat
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

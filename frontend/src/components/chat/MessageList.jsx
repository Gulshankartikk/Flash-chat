/*
 * MESSAGE SCROLL & PAGINATION ARCHITECTURE
 *
 * MessageList (flex-1 min-h-0 relative overflow-hidden)
 *   └── ScrollContainer (h-full overflow-y-auto px-4 py-6)
 *         ├── Encryption Banner (E2EE indicator)
 *         ├── Loading Spinner (Infinite scroll older messages)
 *         ├── Day Dividers (Grouped by date)
 *         └── MessageBubble[] (Interactive bubbles)
 *
 * Scroll Rules:
 * 1. Initial mount: Instantly jumps to bottom (`scrollToBottom("instant")`).
 * 2. New message arrives:
 *    - If user is already near bottom (<= NEAR_BOTTOM_THRESHOLD), smooth auto-scrolls down.
 *    - If user is reading older history, does NOT force scroll down; keeps position intact.
 * 3. Scrolling up triggers `onLoadMore` when near top (<= TOP_SCROLL_THRESHOLD).
 * 4. Pre-load scroll offset is captured so prepending older messages preserves exact viewport position.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import { ArrowDown, MessageCircle } from "lucide-react";

// Tolerance for the "are we at the top" infinite-scroll trigger. Exact
// scrollTop === 0 is brittle — fast flicks and iOS rubber-band scrolling
// can skip past it (or go negative) without ever landing on exactly 0.
const TOP_SCROLL_THRESHOLD = 50;

// How close to the bottom counts as "near bottom" for auto-scroll purposes.
const NEAR_BOTTOM_THRESHOLD = 200;

function formatDayLabel(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const EmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
    <div className="w-14 h-14 flex items-center justify-center rounded-full bg-[#FF6B00]/10 text-[#FF6B00] mb-3">
      <MessageCircle size={24} />
    </div>
    <p className="text-sm font-semibold text-slate-700 dark:text-[#FFFFFF]">Say hello 👋</p>
    <p className="text-xs text-slate-400 dark:text-[#A0A0A0] mt-1 max-w-[220px]">
      No messages yet. Send the first one to start the conversation.
    </p>
  </div>
);

const MessageList = ({
  messages,
  currentUserId,
  isLoadingMore,
  onLoadMore,
  hasMore,
  onReply,
  onReact,
  onDelete,
  onForward,
  onReplyPreviewClick,
  onRetry,
  onEdit,
  onPin,
  otherUserName,
}) => {
  const containerRef = useRef(null);
  const [showScrollFAB, setShowScrollFAB] = useState(false);

  // Tracks scroll metrics captured right BEFORE a load-more request fires,
  // so we can restore the user's visual position after older messages are
  // prepended. Storing both height and scrollTop (not just height) is what
  // makes the restoration math correct.
  const preLoadScrollRef = useRef({ scrollHeight: 0, scrollTop: 0 });
  const isFirstRenderRef = useRef(true);
  const loadMoreInFlightRef = useRef(false);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  // Initial mount: jump to bottom once, instantly, regardless of message count.
  useEffect(() => {
    if (isFirstRenderRef.current && messages.length > 0) {
      scrollToBottom("instant");
      isFirstRenderRef.current = false;
    }
  }, [messages.length, scrollToBottom]);

  // New message arrived while idle (not loading older history): only
  // auto-scroll if the user is already near the bottom, so we don't yank
  // someone away from history they're reading further up.
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (isFirstRenderRef.current) return;
    if (isLoadingMore || loadMoreInFlightRef.current) return;

    const grew = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (!grew || !containerRef.current) return;

    const { scrollHeight, scrollTop, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_THRESHOLD;

    if (isNearBottom) {
      scrollToBottom("smooth");
    }
  }, [messages.length, isLoadingMore, scrollToBottom]);

  // Restore scroll position after older messages are prepended. Runs once
  // isLoadingMore flips back to false (meaning the new items have already
  // been rendered), using the height/scrollTop captured just before the
  // fetch started. Formula: newScrollTop = newScrollHeight - oldScrollHeight + oldScrollTop.
  // This keeps whatever message the user was looking at in the same visual
  // position, instead of snapping near the top of the newly loaded batch.
  useEffect(() => {
    if (isLoadingMore || !loadMoreInFlightRef.current || !containerRef.current) return;

    const { scrollHeight: oldHeight, scrollTop: oldTop } = preLoadScrollRef.current;
    const newHeight = containerRef.current.scrollHeight;

    containerRef.current.scrollTop = newHeight - oldHeight + oldTop;
    loadMoreInFlightRef.current = false;
  }, [messages.length, isLoadingMore]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    setShowScrollFAB(scrollHeight - scrollTop - clientHeight > 400);

    // Threshold instead of exact 0, and a guard against firing more than
    // once per gesture while a load is already pending.
    if (
      scrollTop <= TOP_SCROLL_THRESHOLD &&
      hasMore &&
      !isLoadingMore &&
      !loadMoreInFlightRef.current &&
      onLoadMore
    ) {
      preLoadScrollRef.current = { scrollHeight, scrollTop };
      loadMoreInFlightRef.current = true;
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Day-grouping is a pure function of `messages` — memoize so it doesn't
  // re-run on every scroll-driven re-render (showScrollFAB toggling, etc).
  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, msg) => {
      const dayKey = new Date(msg.createdAt).toDateString();
      if (!acc.length || acc[acc.length - 1].key !== dayKey) {
        acc.push({
          key: dayKey,
          label: formatDayLabel(msg.createdAt),
          items: [msg],
        });
      } else {
        acc[acc.length - 1].items.push(msg);
      }
      return acc;
    }, []);
  }, [messages]);

  if (messages.length === 0 && !isLoadingMore) {
    return (
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white dark:bg-[#000000] flex flex-col">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden bg-white dark:bg-[#000000]">
      {/* Scrollable Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-6 flex flex-col gap-1.5"
      >
        {/* End-to-End Encryption Banner */}
        <div className="flex justify-center my-2">
          <div className="bg-[#FFD166]/10 border border-[#FFD166]/20 rounded-xl px-4 py-2.5 max-w-xs text-center shadow-sm">
            <p className="text-[11px] text-slate-500 dark:text-[#A0A0A0] leading-relaxed">
              🔒 Messages and calls are end-to-end encrypted. No one outside of this chat, not even Flash Chat, can read or listen to them.
            </p>
          </div>
        </div>

        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {groupedMessages.map((group) => (
          <React.Fragment key={group.key}>
            {/* Day Divider */}
            <div className="flex justify-center my-3.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-[#A0A0A0] bg-slate-100 dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-full px-3 py-1 shadow-sm">
                {group.label}
              </span>
            </div>

            {/* Messages in Group */}
            {group.items.map((msg, idx) => (
              <MessageBubble
                key={msg._id || `pending-${group.key}-${idx}`}
                msg={msg}
                currentUserId={currentUserId}
                otherUserName={otherUserName}
                onRetry={onRetry}
                onReply={onReply}
                onReact={onReact}
                onDelete={onDelete}
                onForward={onForward}
                onEdit={onEdit}
                onPin={onPin}
                onReplyPreviewClick={onReplyPreviewClick}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Jump to bottom FAB */}
      {showScrollFAB && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-4 right-4 p-2.5 bg-[#FF6B00] hover:bg-[#E05E00] text-[#FFFFFF] rounded-full shadow-2xl transition-all hover:scale-105 z-10"
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
};

export default MessageList;
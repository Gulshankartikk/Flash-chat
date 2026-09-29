import React, { useEffect, useRef, useCallback } from 'react';
import { Avatar } from '../common/Avatar';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { MessageSquare, ArrowDown, Users } from 'lucide-react';

export const ChatWindow = () => {
  const scrollContainerRef = useRef(null);
  const isAutoScrollLockedRef = useRef(false);

  const { user } = useAuthStore();
  const {
    activeChat,
    messages,
    hasMore,
    nextCursor,
    isLoadingMessages,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    onlineUsers,
    typingUsers
  } = useChatStore();

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = false) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  // Auto-scroll on initial load or new incoming messages if near bottom
  useEffect(() => {
    if (!isAutoScrollLockedRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Infinite scroll upwards for cursor-based pagination
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Check if user has scrolled up
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isAutoScrollLockedRef.current = !isNearBottom;

    // Trigger cursor pagination when reaching top
    if (el.scrollTop === 0 && hasMore && !isLoadingMessages && activeChat && nextCursor) {
      const prevScrollHeight = el.scrollHeight;
      fetchMessages(activeChat._id, nextCursor).then(() => {
        // Restore scroll position after prepending older messages
        requestAnimationFrame(() => {
          if (el) {
            el.scrollTop = el.scrollHeight - prevScrollHeight;
          }
        });
      });
    }
  };

  if (!activeChat) {
    return (
      <main className="flex-1 hidden md:flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950 p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
          Welcome to Flash Chat
        </h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          Select an existing conversation from the sidebar or search for users to experience instant, real-time messaging.
        </p>
      </main>
    );
  }

  // Determine chat name, avatar, and active status
  let chatTitle = activeChat.name;
  let chatAvatar = activeChat.avatar;
  let isParticipantOnline = false;

  if (!activeChat.isGroup) {
    const otherParticipant = activeChat.participants?.find((p) => p._id !== user?._id);
    chatTitle = otherParticipant?.name || 'Private Chat';
    chatAvatar = otherParticipant?.avatar;
    isParticipantOnline = otherParticipant ? onlineUsers.has(otherParticipant._id) : false;
  }

  const currentTypingList = typingUsers[activeChat._id] || [];
  const otherTypingList = currentTypingList.filter((name) => name !== user?.name);

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-50/30 dark:bg-slate-950 overflow-hidden">
      {/* Chat Header */}
      <header className="px-6 py-3.5 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <Avatar
            src={chatAvatar}
            name={chatTitle}
            size="md"
            isOnline={isParticipantOnline}
            showStatus={!activeChat.isGroup}
          />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {chatTitle}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {otherTypingList.length > 0 ? (
                <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 animate-pulse">
                  {otherTypingList.join(', ')} {otherTypingList.length > 1 ? 'are' : 'is'} typing...
                </span>
              ) : activeChat.isGroup ? (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {activeChat.participants?.length || 0} members
                </span>
              ) : (
                <span
                  className={`text-[11px] font-medium ${
                    isParticipantOnline
                      ? 'text-emerald-500'
                      : 'text-slate-400'
                  }`}
                >
                  {isParticipantOnline ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Message Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1"
      >
        {/* Cursor Pagination Loading Indicator */}
        {isLoadingMessages && (
          <div className="py-2 text-center">
            <span className="text-xs text-slate-400 inline-block px-3 py-1 bg-white dark:bg-slate-800 rounded-full shadow-xs border border-slate-200 dark:border-slate-700">
              Loading older messages...
            </span>
          </div>
        )}

        {messages.length === 0 && !isLoadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none opacity-80">
            <p className="text-xs text-slate-400">
              This is the beginning of your conversation with <strong>{chatTitle}</strong>.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Say hello or share a message below!
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender?._id === user?._id || message.sender?._id === 'me';
            return (
              <MessageBubble
                key={message._id}
                message={message}
                isOwn={isOwn}
                isGroup={activeChat.isGroup}
                onEdit={editMessage}
                onDelete={deleteMessage}
              />
            );
          })
        )}
      </div>

      {/* Message Input Bar */}
      <MessageInput
        chatId={activeChat._id}
        onSendMessage={sendMessage}
      />
    </main>
  );
};

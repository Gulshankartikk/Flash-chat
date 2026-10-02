import React, { useState, useEffect, useRef } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Video,
  Search,
  MoreVertical,
  Info,
  Clock,
  Sparkles,
  X,
  User
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { GroupInfoPanel } from './GroupInfoPanel';
import { EmptyState } from '../EmptyState';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCall } from '../../features/calls';

export const ChatWindow = ({ conversationId, onBack }) => {
  const navigate = useNavigate();
  const { startCall, callState } = useCall();
  const {
    activeConversation,
    selectConversation,
    messages,
    fetchMessages,
    hasMore,
    nextCursor,
    isLoadingMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    toggleStar,
    forwardMessage,
    startTyping,
    stopTyping,
    typingUsers
  } = useChatStore();

  const { user } = useAuthStore();
  const currentUserId = user?._id;

  const [replyingTo, setReplyingTo] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [inChatSearch, setInChatSearch] = useState('');
  const [showInChatSearch, setShowInChatSearch] = useState(false);

  const scrollRef = useRef(null);
  const isAutoScrollLocked = useRef(false);

  // If conversationId prop is supplied and different from activeConversation, select it
  useEffect(() => {
    if (conversationId && String(activeConversation?._id) !== String(conversationId)) {
      selectConversation(conversationId);
    }
  }, [conversationId, activeConversation?._id, selectConversation]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && !isAutoScrollLocked.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle scroll up to load older messages
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight } = scrollRef.current;

    // If near top and has more messages, fetch previous
    if (scrollTop < 80 && hasMore && nextCursor && !isLoadingMessages) {
      isAutoScrollLocked.current = true;
      const prevScrollHeight = scrollHeight;
      fetchMessages(activeConversation?._id, nextCursor).then(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeight;
        }
        isAutoScrollLocked.current = false;
      });
    }
  };

  if (!activeConversation) {
    return (
      <div className="hidden md:flex flex-col items-center justify-center h-full flex-1 bg-[#FFF7ED]/30 text-center p-8">
        <EmptyState
          emoji="⚡"
          title="Flash Chat Messaging"
          description="Select a conversation from the sidebar or start a new chat to begin real-time messaging."
        />
      </div>
    );
  }

  const isGroup = activeConversation.type === 'group';
  const otherUser = activeConversation.otherUser;

  // Typing state for this conversation
  const typers = typingUsers[activeConversation._id] || [];
  const isTyping = typers.some((t) => t.userId !== currentUserId);
  const typerName = typers.find((t) => t.userId !== currentUserId)?.userName || 'Someone';

  // Subheader status text
  const getSubheader = () => {
    if (isTyping) return `${typerName} is typing...`;
    if (isGroup) return `${activeConversation.members?.length || 0} participants`;
    if (otherUser?.isOnline) return 'Online';
    if (otherUser?.lastSeen && otherUser.privacy?.lastSeen !== 'nobody') {
      return `Last seen ${format(new Date(otherUser.lastSeen), 'p')}`;
    }
    return 'Flash Chat Direct';
  };

  // Filter messages if in-chat search active
  const displayedMessages = inChatSearch.trim()
    ? messages.filter((m) =>
        (m.text || '').toLowerCase().includes(inChatSearch.toLowerCase().trim())
      )
    : messages;

  return (
    <div className="relative flex flex-col h-full flex-1 bg-[#FFF7ED]/20 overflow-hidden">
      {/* Chat Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#FED7AA] z-10 select-none shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden p-1.5 rounded-full hover:bg-orange-50 text-[#6B7280] hover:text-[#1F2937]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Avatar */}
          <div
            onClick={() => isGroup && setShowGroupInfo(true)}
            className={isGroup ? 'cursor-pointer' : ''}
          >
            <Avatar
              src={activeConversation.displayAvatar}
              alt={activeConversation.displayName}
              size="md"
              isOnline={otherUser?.isOnline}
              showStatus={!isGroup}
            />
          </div>

          {/* Name & Presence */}
          <div
            onClick={() => isGroup && setShowGroupInfo(true)}
            className={`min-w-0 ${isGroup ? 'cursor-pointer' : ''}`}
          >
            <h3 className="text-sm font-bold text-[#1F2937] truncate">
              {activeConversation.displayName}
            </h3>
            <p
              className={`text-[11px] truncate font-medium ${
                isTyping
                  ? 'text-[#F97316] animate-pulse font-bold'
                  : otherUser?.isOnline
                  ? 'text-emerald-600'
                  : 'text-[#6B7280]'
              }`}
            >
              {getSubheader()}
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5 text-[#6B7280]">
          {/* In-chat search toggle */}
          <button
            type="button"
            onClick={() => setShowInChatSearch(!showInChatSearch)}
            className="p-2 rounded-xl hover:bg-[#FFF7ED] hover:text-[#F97316] transition cursor-pointer"
            title="Search in conversation"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Voice & Video Call Buttons */}
          <button
            type="button"
            disabled={callState !== 'idle'}
            onClick={() =>
              startCall({
                conversationId: activeConversation._id,
                type: 'audio'
              })
            }
            className={`p-2 rounded-xl transition cursor-pointer ${
              callState !== 'idle'
                ? 'opacity-40 cursor-not-allowed text-gray-300'
                : 'hover:bg-[#FFF7ED] hover:text-[#F97316]'
            }`}
            title="Start voice call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={callState !== 'idle'}
            onClick={() =>
              startCall({
                conversationId: activeConversation._id,
                type: 'video'
              })
            }
            className={`p-2 rounded-xl transition cursor-pointer ${
              callState !== 'idle'
                ? 'opacity-40 cursor-not-allowed text-gray-300'
                : 'hover:bg-[#FFF7ED] hover:text-[#F97316]'
            }`}
            title="Start video call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* View Profile button for direct chats */}
          {!isGroup && otherUser?.username && (
            <button
              type="button"
              onClick={() => navigate(`/u/${otherUser.username}`)}
              className="p-2 rounded-xl hover:bg-[#FFF7ED] hover:text-[#F97316] transition cursor-pointer"
              title="View Social Profile"
            >
              <User className="w-4 h-4" />
            </button>
          )}

          {/* Group info panel toggle */}
          {isGroup && (
            <button
              type="button"
              onClick={() => setShowGroupInfo(true)}
              className="p-2 rounded-xl hover:bg-[#FFF7ED] hover:text-[#F97316] transition cursor-pointer"
              title="Group settings & info"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* In-Chat Message Search Drawer */}
      {showInChatSearch && (
        <div className="p-2.5 bg-white border-b border-[#FED7AA] flex items-center gap-2 animate-slideDown">
          <Search className="w-4 h-4 text-[#F97316]" />
          <input
            type="text"
            placeholder="Search words in this chat..."
            value={inChatSearch}
            onChange={(e) => setInChatSearch(e.target.value)}
            className="flex-1 text-xs py-1.5 px-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
          <button
            type="button"
            onClick={() => {
              setInChatSearch('');
              setShowInChatSearch(false);
            }}
            className="p-1 text-[#6B7280] hover:text-[#1F2937]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Disappearing Messages Notice Banner */}
      {activeConversation.disappearAfter && (
        <div className="bg-orange-50 border-b border-[#FED7AA]/60 py-1 px-4 text-center text-[10px] text-orange-800 font-semibold flex items-center justify-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>Disappearing messages enabled ({activeConversation.disappearAfter / 86400} days)</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {isLoadingMessages && (
          <div className="p-2 text-center text-xs text-[#6B7280] animate-pulse">
            Loading older messages...
          </div>
        )}

        {displayedMessages.map((msg, index) => {
          const isOwn = String(msg.sender?._id || msg.sender) === String(currentUserId);
          const prevMsg = displayedMessages[index - 1];

          // Check if date changed between consecutive messages
          const showDateSeparator =
            !prevMsg || !isSameDay(new Date(msg.createdAt), new Date(prevMsg.createdAt));

          const getDateLabel = (dateStr) => {
            const date = new Date(dateStr);
            if (isToday(date)) return 'Today';
            if (isYesterday(date)) return 'Yesterday';
            return format(date, 'MMMM d, yyyy');
          };

          return (
            <React.Fragment key={msg._id || index}>
              {showDateSeparator && (
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-white border border-[#FED7AA] text-[10px] font-bold text-[#6B7280] shadow-xs select-none">
                    {getDateLabel(msg.createdAt)}
                  </span>
                </div>
              )}

              <MessageBubble
                message={msg}
                isOwn={isOwn}
                isGroup={isGroup}
                currentUserId={currentUserId}
                onReply={(m) => setReplyingTo(m)}
                onEdit={(m) => {
                  const updatedText = window.prompt('Edit your message:', m.text);
                  if (updatedText && updatedText.trim()) {
                    editMessage(m._id, updatedText.trim());
                  }
                }}
                onDelete={(msgId, scope) => deleteMessage(msgId, scope)}
                onReact={(msgId, emoji) => reactToMessage(msgId, emoji)}
                onStar={(msgId) => toggleStar(msgId)}
                onForward={(m) => {
                  const targetId = window.prompt('Enter target conversation ID to forward:');
                  if (targetId) forwardMessage(m._id, [targetId]);
                }}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Bottom Message Input Bar */}
      <MessageInput
        onSend={(payload) => sendMessage(payload)}
        onTypingStart={startTyping}
        onTypingStop={stopTyping}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Group Info Slide-Over Panel */}
      <GroupInfoPanel
        conversation={activeConversation}
        currentUserId={currentUserId}
        isOpen={showGroupInfo}
        onClose={() => setShowGroupInfo(false)}
        onUpdateConversation={(updated) => selectConversation(updated)}
      />
    </div>
  );
};

export default ChatWindow;

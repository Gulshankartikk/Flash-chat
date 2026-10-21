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
import { ForwardModal } from './ForwardModal';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCall } from '../../features/calls';
import { SaveToPocketSheet } from '../../features/pocket';
import { AiSheet, AiConsentDialog, fetchChatSummary, useAiTask } from '../../features/ai';

export const ChatWindow = ({ conversationId, onBack }) => {
  const navigate = useNavigate();
  const { startCall, callState } = useCall();
  const {
    conversations,
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
    typingUsers,
    onlineUsers
  } = useChatStore();

  const { user } = useAuthStore();
  const currentUserId = user?._id;

  const [replyingTo, setReplyingTo] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [inChatSearch, setInChatSearch] = useState('');
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [saveTarget, setSaveTarget] = useState(null);
  const [forwardTargetMessage, setForwardTargetMessage] = useState(null);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const { acceptMessageRequest, rejectMessageRequest } = useChatStore();

  // AI Sheet & Summarize states
  const [showAiSheet, setShowAiSheet] = useState(false);
  const [aiSheetTitle, setAiSheetTitle] = useState('Flash AI Summary');
  const [aiSheetContent, setAiSheetContent] = useState('');
  const [aiSheetLoading, setAiSheetLoading] = useState(false);
  const [aiSheetError, setAiSheetError] = useState(null);
  const [showSummarizeMenu, setShowSummarizeMenu] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const { executeTask } = useAiTask();

  const handleSummarize = async (range) => {
    setShowSummarizeMenu(false);
    const consent = localStorage.getItem('flash_ai_consent');
    if (!consent) {
      setShowConsent(true);
      return;
    }

    setShowAiSheet(true);
    setAiSheetTitle(`Chat Summary (${range})`);
    setAiSheetLoading(true);
    setAiSheetError(null);
    setAiSheetContent('');

    try {
      const summary = await fetchChatSummary({
        conversationId: activeConversation._id,
        range
      });
      setAiSheetContent(summary);
    } catch (err) {
      setAiSheetError(err);
    } finally {
      setAiSheetLoading(false);
    }
  };

  const handleAskAiAboutMessage = (msg) => {
    setShowAiSheet(true);
    setAiSheetTitle('Ask Flash AI');
    setAiSheetContent(`### Message Context:\n> "${msg.text}"\n\n*Tap "Use this" or continue in the dedicated AI tab to discuss this topic in detail.*`);
  };

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
  const otherUserId = otherUser?._id ? String(otherUser._id) : null;
  const isOtherOnline =
    otherUserId && (onlineUsers instanceof Set ? onlineUsers.has(otherUserId) : false)
      ? true
      : Boolean(otherUser?.isOnline);

  // Typing state for this conversation
  const typers = typingUsers[activeConversation._id] || [];
  const isTyping = typers.some((t) => t.userId !== currentUserId);
  const typerName = typers.find((t) => t.userId !== currentUserId)?.userName || 'Someone';

  // Subheader status text
  const getSubheader = () => {
    if (isTyping) return `${typerName} is typing...`;
    if (isGroup) return `${activeConversation.members?.length || 0} participants`;
    if (isOtherOnline) return 'Active now';
    if (otherUser?.lastSeen && otherUser.privacy?.lastSeen !== 'nobody') {
      return `Last seen ${format(new Date(otherUser.lastSeen), 'p')}`;
    }
    return 'Offline';
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
              isOnline={isOtherOnline}
              showStatus={!isGroup}
            />
          </div>

          {/* Name & Presence */}
          <div
            onClick={() => isGroup && setShowGroupInfo(true)}
            className={`min-w-0 ${isGroup ? 'cursor-pointer' : ''}`}
          >
            <h3 className="text-sm font-bold text-[#1F2937] truncate flex items-center gap-1.5">
              <span>{activeConversation.displayName}</span>
              {!isGroup && otherUser?.username && (
                <span className="text-[11px] font-normal text-[#6B7280] truncate">@{otherUser.username}</span>
              )}
            </h3>
            <p
              className={`text-[11px] truncate font-medium ${
                isTyping
                  ? 'text-primary animate-pulse font-bold'
                  : isOtherOnline
                  ? 'text-primary font-medium'
                  : 'text-muted'
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

          {/* AI Summarize Chat Dropdown Toggle */}
          {activeConversation.allowAi !== false && user?.aiSettings?.aiInChats !== false && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSummarizeMenu(!showSummarizeMenu)}
                className="p-2 rounded-xl text-[#F97316] hover:bg-orange-50 transition cursor-pointer"
                title="Summarize conversation with AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              {showSummarizeMenu && (
                <div className="absolute right-0 top-11 z-30 p-2 rounded-2xl bg-white border border-[#FED7AA] shadow-xl text-xs space-y-1 w-44 animate-scaleUp">
                  <p className="px-2 py-1 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                    Summarize with AI
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSummarize('unread')}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[#FFF7ED] text-[#1F2937] transition font-medium cursor-pointer"
                  >
                    Unread Messages
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSummarize('today')}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[#FFF7ED] text-[#1F2937] transition font-medium cursor-pointer"
                  >
                    Today's Discussion
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSummarize('last50')}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[#FFF7ED] text-[#1F2937] transition font-medium cursor-pointer"
                  >
                    Last 50 Messages
                  </button>
                </div>
              )}
            </div>
          )}

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

      {/* Message Request Notice Banner */}
      {activeConversation.status === 'request' && (
        <div className="bg-primary/10 border-b border-primary/20 py-2.5 px-4 text-center text-xs text-ink font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>Message Request:</strong> Accept this request to start chatting, calling, and sharing media.
          </span>
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

        {displayedMessages.length === 0 && !isLoadingMessages && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center my-auto select-none">
            <div className="p-3 rounded-full bg-primary/10 text-primary mb-3 shadow-xs">
              <Avatar
                src={activeConversation.displayAvatar}
                alt={activeConversation.displayName}
                size="lg"
                isOnline={isOtherOnline}
                showStatus={!isGroup}
              />
            </div>
            <h4 className="text-sm font-bold text-[#1F2937]">
              {activeConversation.displayName}
            </h4>
            {!isGroup && otherUser?.username && (
              <p className="text-xs text-[#6B7280] mb-2">@{otherUser.username}</p>
            )}
            <p className="text-xs text-[#6B7280] max-w-xs mt-1">
              No messages here yet. Say hello to start the conversation!
            </p>
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
                isRestricted={activeConversation.status === 'request'}
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
                onForward={(m) => setForwardTargetMessage(m)}
                onSaveToPocket={(m) => {
                  setSaveTarget({
                    from: 'chat_message',
                    refId: m._id,
                    text: m.text || '',
                    title: m.text ? `${m.text.slice(0, 30)}...` : 'Saved Message'
                  });
                }}
                onAskAi={handleAskAiAboutMessage}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Save to Pocket Modal Sheet */}
      <SaveToPocketSheet
        isOpen={!!saveTarget}
        onClose={() => setSaveTarget(null)}
        target={saveTarget}
      />

      {/* Message Forward Modal */}
      <ForwardModal
        isOpen={!!forwardTargetMessage}
        message={forwardTargetMessage}
        conversations={conversations}
        onClose={() => setForwardTargetMessage(null)}
        onForward={(msgId, convIds) => forwardMessage(msgId, convIds)}
      />

      {/* AI Assistant Sheet for Summaries & Message Explanations */}
      <AiSheet
        isOpen={showAiSheet}
        onClose={() => setShowAiSheet(false)}
        title={aiSheetTitle}
        content={aiSheetContent}
        loading={aiSheetLoading}
        error={aiSheetError}
        onRegenerate={() => handleSummarize('last50')}
        onUse={() => {
          if (aiSheetContent && typeof aiSheetContent === 'string') {
            sendMessage({
              text: aiSheetContent,
              type: 'text'
            });
            setShowAiSheet(false);
          }
        }}
        useButtonLabel="Send to Chat"
      />

      {/* AI Privacy Consent Dialog */}
      <AiConsentDialog
        isOpen={showConsent}
        onClose={() => setShowConsent(false)}
        onAccept={() => handleSummarize('last50')}
      />

      {/* Bottom Message Input Bar OR Message Request Actions Bar */}
      {activeConversation.status === 'request' ? (
        <div className="p-4 bg-card border-t border-line space-y-2">
          {requestError && (
            <p className="text-xs text-accent text-center font-semibold">{requestError}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={isProcessingRequest}
              onClick={async () => {
                setIsProcessingRequest(true);
                setRequestError(null);
                try {
                  await acceptMessageRequest(activeConversation._id);
                } catch (err) {
                  setRequestError(err.response?.data?.message || 'Failed to accept request');
                } finally {
                  setIsProcessingRequest(false);
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-xs shadow-md shadow-primary/25 hover:brightness-105 transition cursor-pointer disabled:opacity-50"
            >
              Accept
            </button>

            <button
              type="button"
              disabled={isProcessingRequest}
              onClick={async () => {
                if (window.confirm('Delete this message request?')) {
                  setIsProcessingRequest(true);
                  try {
                    await rejectMessageRequest(activeConversation._id);
                    if (onBack) onBack();
                  } catch (err) {
                    setRequestError(err.response?.data?.message || 'Failed to delete request');
                  } finally {
                    setIsProcessingRequest(false);
                  }
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-cream border border-line text-ink hover:text-accent font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              Delete
            </button>

            <button
              type="button"
              disabled={isProcessingRequest}
              onClick={async () => {
                if (window.confirm('Block this user? They will not be able to message you.')) {
                  setIsProcessingRequest(true);
                  try {
                    if (otherUser?._id) {
                      await api.post(`/users/${otherUser._id}/block`);
                    }
                    await rejectMessageRequest(activeConversation._id);
                    if (onBack) onBack();
                  } catch (err) {
                    setRequestError(err.response?.data?.message || 'Failed to block user');
                  } finally {
                    setIsProcessingRequest(false);
                  }
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-cream border border-line text-muted hover:text-ink font-semibold text-xs transition cursor-pointer disabled:opacity-50"
            >
              Block
            </button>

            <button
              type="button"
              disabled={isProcessingRequest}
              onClick={() => {
                const reason = window.prompt('Report reason:');
                if (reason && otherUser?._id) {
                  api.post('/reports', { targetUserId: otherUser._id, reason }).catch(() => {});
                  alert('Thank you for reporting. Our safety team will review it.');
                }
              }}
              className="px-3 py-2.5 rounded-xl text-muted hover:text-ink font-semibold text-xs transition cursor-pointer"
            >
              Report
            </button>
          </div>
        </div>
      ) : (
        <MessageInput
          conversationId={activeConversation._id}
          allowAi={activeConversation.allowAi !== false && user?.aiSettings?.aiInChats !== false}
          onSend={(payload) => sendMessage(payload)}
          onTypingStart={startTyping}
          onTypingStop={stopTyping}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}

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

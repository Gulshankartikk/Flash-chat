import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { NewChatModal } from '../components/chat/NewChatModal';
import { PendingChatScreen } from '../features/contacts/PendingChatScreen';
import { useChatStore } from '../store/useChatStore';

export const ChatPage = () => {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    fetchConversations,
    fetchPendingConversations,
    initSocketEvents,
    activeConversation,
    selectConversation,
    startDirectConversation
  } = useChatStore();

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedPending, setSelectedPending] = useState(null);

  // Keyboard shortcut: 'N' opens New Chat modal when not typing in an input
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsNewChatOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize conversations and socket events
  useEffect(() => {
    fetchConversations();
    fetchPendingConversations();
    initSocketEvents();
  }, [fetchConversations, fetchPendingConversations, initSocketEvents]);

  // Handle route param :conversationId
  useEffect(() => {
    if (conversationId && String(activeConversation?._id) !== String(conversationId)) {
      setSelectedPending(null);
      selectConversation(conversationId);
    }
  }, [conversationId, activeConversation?._id, selectConversation]);

  // Handle deep link /chats/new?userId=<id> or /chats?userId=<id>
  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    if (targetUserId) {
      startDirectConversation(targetUserId).then((conv) => {
        if (conv?._id) {
          navigate(`/chats/${conv._id}`, { replace: true });
        }
      });
    }
  }, [searchParams, startDirectConversation, navigate]);

  const handleSelect = (conv) => {
    setSelectedPending(null);
    selectConversation(conv);
    navigate(`/chats/${conv._id}`);
  };

  const handleSelectPending = (pending) => {
    selectConversation(null);
    setSelectedPending(pending);
  };

  const handleBackToMobileList = () => {
    setSelectedPending(null);
    selectConversation(null);
    navigate('/chats');
  };

  const hasActiveView = Boolean(activeConversation || selectedPending);

  return (
    <div className="flex h-full w-full overflow-hidden bg-card">
      {/* Conversation List Pane (Hidden on mobile if a chat or pending is actively selected) */}
      <div
        className={`${
          hasActiveView ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 h-full flex-shrink-0`}
      >
        <ConversationList
          onSelectConversation={handleSelect}
          onSelectPending={handleSelectPending}
          onOpenNewChat={() => setIsNewChatOpen(true)}
        />
      </div>

      {/* Chat Window / Pending Screen Pane */}
      <div
        className={`${
          hasActiveView ? 'flex' : 'hidden md:flex'
        } flex-1 h-full overflow-hidden`}
      >
        {selectedPending ? (
          <PendingChatScreen
            pendingConversation={selectedPending}
            onBack={handleBackToMobileList}
            onDeleted={() => {
              setSelectedPending(null);
              fetchPendingConversations();
            }}
          />
        ) : (
          <ChatWindow
            conversationId={activeConversation?._id}
            onBack={handleBackToMobileList}
          />
        )}
      </div>

      {/* New 1:1 or Group Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onChatCreated={(conv) => {
          setSelectedPending(null);
          navigate(`/chats/${conv._id}`);
        }}
      />
    </div>
  );
};

export default ChatPage;

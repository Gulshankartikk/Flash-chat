import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { NewChatModal } from '../components/chat/NewChatModal';
import { useChatStore } from '../store/useChatStore';

export const ChatPage = () => {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    fetchConversations,
    initSocketEvents,
    activeConversation,
    selectConversation,
    startDirectConversation
  } = useChatStore();

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  // Initialize conversations and socket events
  useEffect(() => {
    fetchConversations();
    initSocketEvents();
  }, [fetchConversations, initSocketEvents]);

  // Handle route param :conversationId
  useEffect(() => {
    if (conversationId && String(activeConversation?._id) !== String(conversationId)) {
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
    selectConversation(conv);
    navigate(`/chats/${conv._id}`);
  };

  const handleBackToMobileList = () => {
    selectConversation(null);
    navigate('/chats');
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Conversation List Pane (Hidden on mobile if a chat is actively selected) */}
      <div
        className={`${
          activeConversation ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 h-full flex-shrink-0`}
      >
        <ConversationList
          onSelectConversation={handleSelect}
          onOpenNewChat={() => setIsNewChatOpen(true)}
        />
      </div>

      {/* Chat Window Pane (Hidden on mobile if no chat is selected) */}
      <div
        className={`${
          activeConversation ? 'flex' : 'hidden md:flex'
        } flex-1 h-full overflow-hidden`}
      >
        <ChatWindow
          conversationId={activeConversation?._id}
          onBack={handleBackToMobileList}
        />
      </div>

      {/* New 1:1 or Group Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onChatCreated={(conv) => {
          navigate(`/chats/${conv._id}`);
        }}
      />
    </div>
  );
};

export default ChatPage;

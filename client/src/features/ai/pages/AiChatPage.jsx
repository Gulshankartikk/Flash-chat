import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Menu,
  Plus,
  Sparkles,
  Zap,
  Info,
  WifiOff,
  ChevronLeft,
  Settings
} from 'lucide-react';
import { AiConversationList } from '../components/AiConversationList';
import { AiChatView } from '../components/AiChatView';
import { AiComposer } from '../components/AiComposer';
import { UsageMeter } from '../components/UsageMeter';
import { AiConsentDialog } from '../components/AiConsentDialog';
import { useAiStream } from '../hooks/useAiStream';
import { useAiStore } from '../store/useAiStore';
import * as aiApi from '../api/aiApi';

export const AiChatPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const activeChatId = useAiStore((s) => s.activeChatId);
  const setActiveChatId = useAiStore((s) => s.setActiveChatId);
  const isStreamingGlobal = useAiStore((s) => s.isStreaming);

  const {
    text: streamingText,
    isStreaming,
    status: streamStatus,
    error: streamError,
    startStream,
    stopStream
  } = useAiStream();

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check consent
  useEffect(() => {
    const consent = localStorage.getItem('flash_ai_consent');
    if (!consent) {
      setShowConsent(true);
    }
  }, []);

  // Fetch conversations list
  const loadConversations = useCallback(async () => {
    try {
      setLoadingList(true);
      const list = await aiApi.fetchAiConversations();
      setConversations(list || []);
    } catch (err) {
      console.error('Failed to load AI conversations', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load active conversation
  const loadActiveConversation = useCallback(
    async (id) => {
      if (!id) {
        setCurrentConversation(null);
        setActiveChatId(null);
        return;
      }
      try {
        const conv = await aiApi.fetchAiConversation(id);
        setCurrentConversation(conv);
        setActiveChatId(id);
      } catch (err) {
        console.error('Failed to load AI conversation', err);
        navigate('/ai');
      }
    },
    [navigate, setActiveChatId]
  );

  useEffect(() => {
    if (chatId) {
      loadActiveConversation(chatId);
    } else {
      setCurrentConversation(null);
      setActiveChatId(null);
    }
  }, [chatId, loadActiveConversation, setActiveChatId]);

  // When stream finishes, refresh active conversation messages
  useEffect(() => {
    if (streamStatus === 'done' && (chatId || currentConversation?._id)) {
      loadActiveConversation(chatId || currentConversation?._id);
      loadConversations();
    }
  }, [streamStatus, chatId, currentConversation?._id, loadActiveConversation, loadConversations]);

  // Create new chat
  const handleNewChat = async () => {
    try {
      const newConv = await aiApi.createAiConversation({ title: 'New Chat' });
      setConversations((prev) => [newConv, ...prev]);
      setShowMobileDrawer(false);
      navigate(`/ai/${newConv._id}`);
    } catch (err) {
      console.error('Failed to create new AI conversation', err);
    }
  };

  // Select conversation
  const handleSelectConversation = (id) => {
    setShowMobileDrawer(false);
    navigate(`/ai/${id}`);
  };

  // Rename conversation
  const handleRename = async (id, title) => {
    try {
      await aiApi.updateAiConversation(id, { title });
      setConversations((prev) =>
        prev.map((c) => (c._id === id ? { ...c, title } : c))
      );
      if (currentConversation?._id === id) {
        setCurrentConversation((prev) => ({ ...prev, title }));
      }
    } catch (err) {
      console.error('Failed to rename conversation', err);
    }
  };

  // Pin / Unpin
  const handlePin = async (id, isPinned) => {
    try {
      await aiApi.updateAiConversation(id, { isPinned });
      loadConversations();
    } catch (err) {
      console.error('Failed to pin conversation', err);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    try {
      await aiApi.deleteAiConversation(id);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      if (currentConversation?._id === id) {
        navigate('/ai');
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  // Send message
  const handleSend = async ({ message, attachments }) => {
    let targetChatId = currentConversation?._id;

    // If on /ai without existing conversation, create one first
    if (!targetChatId) {
      try {
        const newConv = await aiApi.createAiConversation({
          title: message.slice(0, 30) + '...'
        });
        targetChatId = newConv._id;
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConversation(newConv);
        setActiveChatId(newConv._id);
        navigate(`/ai/${newConv._id}`, { replace: true });
      } catch (err) {
        console.error('Failed to initialize conversation before send', err);
        return;
      }
    }

    // Optimistically push user message to UI
    const optimisticUserMsg = {
      role: 'user',
      text: message,
      attachments,
      createdAt: new Date()
    };
    setCurrentConversation((prev) => ({
      ...prev,
      messages: [...(prev?.messages || []), optimisticUserMsg]
    }));

    // Start streaming SSE
    startStream({
      chatId: targetChatId,
      message,
      attachments
    });
  };

  // Regenerate last response
  const handleRegenerate = () => {
    if (!currentConversation || currentConversation.messages.length === 0) return;
    const msgs = currentConversation.messages;
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    startStream({
      chatId: currentConversation._id,
      message: lastUserMsg.text,
      attachments: lastUserMsg.attachments
    });
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] md:h-screen w-full bg-cream dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Desktop Left Sidebar: Conversation List (300px) */}
      <div className="hidden md:block w-80 h-full shrink-0">
        <AiConversationList
          conversations={conversations}
          activeId={currentConversation?._id}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onRename={handleRename}
          onPin={handlePin}
          onDelete={handleDelete}
          loading={loadingList}
        />
      </div>

      {/* Mobile Drawer (Slide over) */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/50 backdrop-blur-sm">
          <div className="w-4/5 max-w-xs h-full bg-card dark:bg-zinc-900 shadow-2xl">
            <AiConversationList
              conversations={conversations}
              activeId={currentConversation?._id}
              onSelect={handleSelectConversation}
              onNewChat={handleNewChat}
              onRename={handleRename}
              onPin={handlePin}
              onDelete={handleDelete}
              loading={loadingList}
            />
          </div>
          <div className="flex-1" onClick={() => setShowMobileDrawer(false)} />
        </div>
      )}

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-card dark:bg-zinc-900 border-l border-line dark:border-zinc-800">
        {/* Workspace Top Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowMobileDrawer(true)}
              className="md:hidden p-2 rounded-xl text-muted hover:text-ink dark:hover:text-cream hover:bg-cream dark:hover:bg-zinc-800 transition-colors"
              title="Open conversations"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Title */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-sm shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-ink dark:text-cream truncate">
                  {currentConversation?.title || 'Flash AI'}
                </h1>
                <p className="text-[10px] text-muted truncate">Flash AI Assistant</p>
              </div>
            </div>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-2">
            <UsageMeter compact className="hidden sm:flex" />

            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-cream dark:bg-zinc-800 border border-line dark:border-zinc-700 text-xs font-semibold text-ink dark:text-cream hover:border-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs shrink-0">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>You are currently offline. AI responses cannot be generated until reconnected.</span>
          </div>
        )}

        {/* Chat Message View */}
        <AiChatView
          conversation={currentConversation}
          messages={currentConversation?.messages || []}
          streamingText={streamingText}
          isStreaming={isStreaming}
          onRegenerate={handleRegenerate}
          onSuggestionClick={(prompt) => handleSend({ message: prompt, attachments: [] })}
          onShareToChat={(text) => {
            // Part 3 will connect to ShareSheet
            navigator.clipboard.writeText(text);
            alert('Response copied to clipboard! (Ready to paste into chats)');
          }}
        />

        {/* Composer */}
        <AiComposer
          onSend={handleSend}
          onStop={stopStream}
          isStreaming={isStreaming}
          disabled={!isOnline}
        />
      </div>

      {/* Consent Dialog on First Open */}
      <AiConsentDialog
        isOpen={showConsent}
        onClose={() => setShowConsent(false)}
        onAccept={() => setShowConsent(false)}
      />
    </div>
  );
};

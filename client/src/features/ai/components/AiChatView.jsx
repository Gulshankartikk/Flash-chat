import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Share2,
  ArrowDown,
  Image as ImageIcon
} from 'lucide-react';
import { AiBadge } from './AiBadge';
import { AiThinking } from './AiThinking';
import { AiMarkdown } from './AiMarkdown';
import { saveAiAnswerToPocket } from '../../pocket/hooks/useSaveToPocket';
import { submitAiFeedback } from '../api/aiApi';

export const AiChatView = ({
  conversation,
  messages = [],
  streamingText = '',
  isStreaming = false,
  onRegenerate,
  onSuggestionClick,
  onShareToChat,
  className = ''
}) => {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [pocketSavedId, setPocketSavedId] = useState(null);
  const [feedbacks, setFeedbacks] = useState({}); // { [msgId]: 'thumbs_up' | 'thumbs_down' }
  const [isNearBottom, setIsNearBottom] = useState(true);

  const scrollContainerRef = useRef(null);
  const bottomAnchorRef = useRef(null);

  // Check if user is scrolled near bottom
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setIsNearBottom(distanceToBottom < 100);
  }, []);

  // Auto-scroll to bottom only if user is already near bottom
  useEffect(() => {
    if (isNearBottom && bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText, isStreaming, isNearBottom]);

  const scrollToBottom = () => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsNearBottom(true);
  };

  const handleCopy = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (_) {}
  };

  const handleSavePocket = async (msg) => {
    try {
      await saveAiAnswerToPocket({
        text: msg.text,
        prompt: conversation?.title || 'Flash AI Response',
        model: 'gemini'
      });
      setPocketSavedId(msg._id);
      setTimeout(() => setPocketSavedId(null), 3000);
    } catch (err) {
      console.error('Failed to save to Pocket', err);
    }
  };

  const handleFeedback = async (msgId, rating) => {
    try {
      const currentRating = feedbacks[msgId];
      const newRating = currentRating === rating ? 'none' : rating;
      setFeedbacks((prev) => ({ ...prev, [msgId]: newRating }));

      if (conversation?._id && msgId) {
        await submitAiFeedback({
          conversationId: conversation._id,
          messageId: msgId,
          rating: newRating
        });
      }
    } catch (err) {
      console.error('Failed to submit AI feedback', err);
    }
  };

  const suggestions = [
    { label: 'Summarize my unread chats', prompt: 'Summarize my recent chat discussions and highlight key action items.' },
    { label: 'Write an engaging photo caption', prompt: 'Write a viral, creative social media caption with emojis and trending hashtags.' },
    { label: 'What did I save about travel?', prompt: 'Search my Pocket items and tell me what travel notes and recommendations I saved.' },
    { label: 'Explain a complex concept simply', prompt: 'Explain quantum computing in simple, easy-to-understand terms with everyday analogies.' }
  ];

  return (
    <div className={`relative flex-1 flex flex-col h-full bg-cream/30 dark:bg-zinc-950 overflow-hidden ${className}`}>
      {/* Scrollable messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
      >
        {messages.length === 0 && !isStreaming ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 px-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary via-secondary to-accent flex items-center justify-center text-white shadow-xl shadow-primary/25 mb-4 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-ink dark:text-cream">Hi, I'm Flash AI</h2>
            <p className="text-xs text-muted mt-1.5 mb-6">
              Ask questions, summarize chats, brainstorm captions, or search your personal Pocket vault.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSuggestionClick && onSuggestionClick(s.prompt)}
                  className="p-3.5 rounded-2xl bg-card dark:bg-zinc-900 border border-line dark:border-zinc-800 hover:border-primary/50 hover:bg-orange-50/50 dark:hover:bg-zinc-800 transition-all text-xs text-ink/80 dark:text-zinc-200 group shadow-sm"
                >
                  <p className="font-semibold text-ink dark:text-cream group-hover:text-primary transition-colors">
                    {s.label}
                  </p>
                  <p className="text-[11px] text-muted truncate mt-0.5">{s.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <>
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isCopied = copiedIndex === index;
              const isSaved = pocketSavedId === msg._id;
              const feedback = feedbacks[msg._id] || msg.rating;

              return (
                <div
                  key={msg._id || index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl ${
                    isUser ? 'ml-auto' : 'mr-auto'
                  }`}
                >
                  {/* Sender Header for Model */}
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mb-1.5 pl-1">
                      <AiBadge size="xs" />
                      <span className="text-[11px] font-semibold text-muted">Flash AI</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`relative rounded-3xl p-4 sm:p-5 text-sm leading-relaxed shadow-sm transition-all ${
                      isUser
                        ? 'bg-gradient-to-r from-primary to-secondary text-white rounded-br-none shadow-primary/15'
                        : 'bg-card dark:bg-zinc-900 text-ink dark:text-zinc-100 border border-line dark:border-zinc-800 rounded-bl-none'
                    }`}
                  >
                    {/* User attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.attachments.map((att, attIdx) => (
                          <img
                            key={attIdx}
                            src={att.url}
                            alt="Attached context"
                            className="w-28 h-28 object-cover rounded-xl border border-white/20 shadow-sm"
                          />
                        ))}
                      </div>
                    )}

                    {/* Text / Markdown */}
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <AiMarkdown content={msg.text} />
                    )}
                  </div>

                  {/* Model Message Action Toolbar */}
                  {!isUser && (
                    <div className="flex items-center gap-1 mt-1.5 pl-2 text-muted text-xs">
                      {/* Copy */}
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.text, index)}
                        className="p-1.5 rounded-lg hover:text-ink dark:hover:text-cream hover:bg-card dark:hover:bg-zinc-800 transition-colors"
                        title="Copy text"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* Save to Pocket */}
                      <button
                        type="button"
                        onClick={() => handleSavePocket(msg)}
                        className={`p-1.5 rounded-lg hover:bg-card dark:hover:bg-zinc-800 transition-colors ${
                          isSaved ? 'text-secondary' : 'hover:text-secondary'
                        }`}
                        title="Save to Pocket"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>

                      {/* Share to Chat */}
                      {onShareToChat && (
                        <button
                          type="button"
                          onClick={() => onShareToChat(msg.text)}
                          className="p-1.5 rounded-lg hover:text-primary hover:bg-card dark:hover:bg-zinc-800 transition-colors"
                          title="Share into chat"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Thumbs Up / Down */}
                      <button
                        type="button"
                        onClick={() => handleFeedback(msg._id, 'thumbs_up')}
                        className={`p-1.5 rounded-lg hover:bg-card dark:hover:bg-zinc-800 transition-colors ${
                          feedback === 'thumbs_up' ? 'text-primary' : 'hover:text-primary'
                        }`}
                        title="Good response"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFeedback(msg._id, 'thumbs_down')}
                        className={`p-1.5 rounded-lg hover:bg-card dark:hover:bg-zinc-800 transition-colors ${
                          feedback === 'thumbs_down' ? 'text-rose-500' : 'hover:text-rose-500'
                        }`}
                        title="Poor response"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Regenerate (if last message) */}
                      {index === messages.length - 1 && onRegenerate && (
                        <button
                          type="button"
                          onClick={onRegenerate}
                          className="flex items-center gap-1 p-1.5 rounded-lg hover:text-primary hover:bg-card dark:hover:bg-zinc-800 transition-colors text-[11px]"
                          title="Regenerate response"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Streaming Response Bubble */}
            {isStreaming && (
              <div className="flex flex-col items-start max-w-3xl mr-auto">
                <div className="flex items-center gap-1.5 mb-1.5 pl-1">
                  <AiBadge size="xs" />
                  <span className="text-[11px] font-semibold text-muted">Flash AI</span>
                </div>
                <div className="bg-card dark:bg-zinc-900 text-ink dark:text-zinc-100 border border-line dark:border-zinc-800 rounded-3xl rounded-bl-none p-4 sm:p-5 text-sm leading-relaxed shadow-sm">
                  {streamingText ? (
                    <AiMarkdown content={streamingText} />
                  ) : (
                    <AiThinking label="Flash AI is generating..." />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div ref={bottomAnchorRef} />
      </div>

      {/* Floating Jump to Latest Pill */}
      {!isNearBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-card dark:bg-zinc-800 border border-line dark:border-zinc-700 text-xs font-semibold text-ink dark:text-cream shadow-lg hover:bg-cream transition-all animate-bounce"
        >
          <ArrowDown className="w-3.5 h-3.5 text-primary" />
          <span>Latest</span>
        </button>
      )}
    </div>
  );
};

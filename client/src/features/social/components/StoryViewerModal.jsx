import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Trash2,
  Eye,
  Send,
  Heart,
  ChevronLeft,
  ChevronRight,
  MessageCircle
} from 'lucide-react';
import { useSocialStore } from '../store/useSocialStore';
import { markStoryViewedApi, replyToStoryApi, deleteStoryApi } from '../api/api';
import { RelativeTime } from './RelativeTime';
import { SocialAvatar } from './SocialAvatar';

const QUICK_EMOJIS = ['❤️', '🔥', '😂', '👏', '😮', '😢'];

export const StoryViewerModal = () => {
  const navigate = useNavigate();
  const {
    isStoryViewerOpen,
    storyTrayUsers,
    activeUserIndex,
    activeStoryIndex,
    isStoryPaused,
    setStoryPaused,
    closeStoryViewer,
    nextStory,
    prevStory,
    openStoryViewer
  } = useSocialStore();

  const [progress, setProgress] = useState(0); // 0 to 100 for current segment
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyToast, setReplyToast] = useState(null); // { message, conversationId }
  const [showViewersSheet, setShowViewersSheet] = useState(false);

  const videoRef = useRef(null);
  const touchStartY = useRef(null);
  const animationFrameRef = useRef(null);
  const progressStartTimeRef = useRef(null);
  const durationRef = useRef(5000); // 5000ms default for images

  const currentCluster = storyTrayUsers[activeUserIndex];
  const currentStory = currentCluster?.stories?.[activeStoryIndex];
  const isOwnStory = Boolean(currentCluster?.isMe);

  // Mark story viewed idempotently
  useEffect(() => {
    if (!isStoryViewerOpen || !currentStory || isOwnStory) return;
    markStoryViewedApi(currentStory._id).catch(() => {});
  }, [isStoryViewerOpen, currentStory?._id, isOwnStory]);

  // Handle story progress timer
  useEffect(() => {
    if (!isStoryViewerOpen || !currentStory) return;

    setProgress(0);
    progressStartTimeRef.current = Date.now();

    const isVideo = currentStory.media?.type === 'video';
    // If video, wait for metadata to know exact duration, otherwise 5000ms
    durationRef.current = isVideo ? 10000 : 5000;

    let elapsed = 0;
    let lastTick = Date.now();

    const updateTimer = () => {
      if (isStoryPaused || showViewersSheet) {
        lastTick = Date.now();
        animationFrameRef.current = requestAnimationFrame(updateTimer);
        return;
      }

      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;
      elapsed += delta;

      const currentProgress = Math.min((elapsed / durationRef.current) * 100, 100);
      setProgress(currentProgress);

      if (currentProgress >= 100) {
        nextStory();
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTimer);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isStoryViewerOpen, currentStory?._id, activeStoryIndex, activeUserIndex, isStoryPaused, showViewersSheet, nextStory]);

  // Video loadedmetadata listener to set accurate duration
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      durationRef.current = videoRef.current.duration * 1000;
    }
  };

  // Keyboard navigation & gestures
  useEffect(() => {
    if (!isStoryViewerOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeStoryViewer();
      if (e.key === 'ArrowRight') nextStory();
      if (e.key === 'ArrowLeft') prevStory();
      if (e.key === ' ') {
        e.preventDefault();
        setStoryPaused(!isStoryPaused);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStoryViewerOpen, isStoryPaused, closeStoryViewer, nextStory, prevStory, setStoryPaused]);

  if (!isStoryViewerOpen || !currentCluster || !currentStory) {
    return null;
  }

  // Tap handler (left 30% -> prev, right 70% -> next)
  const handleContentClick = (e) => {
    // If clicking on interactive elements, don't advance
    if (e.target.closest('button') || e.target.closest('input')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.3) {
      prevStory();
    } else {
      nextStory();
    }
  };

  // Touch swipe down to close
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    setStoryPaused(true);
  };

  const handleTouchEnd = (e) => {
    setStoryPaused(false);
    if (!touchStartY.current) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80) {
      // Swiped down
      closeStoryViewer();
    }
    touchStartY.current = null;
  };

  // Send reply handler
  const handleSendReply = async (textToSend) => {
    const text = textToSend || replyText;
    if (!text || !text.trim() || isSendingReply) return;

    setIsSendingReply(true);
    try {
      const res = await replyToStoryApi(currentStory._id, text.trim());
      if (res.success) {
        setReplyText('');
        setReplyToast({
          message: 'Reply sent to chat!',
          conversationId: res.conversationId
        });
        setTimeout(() => setReplyToast(null), 5000);
      }
    } catch (err) {
      console.error('Failed to reply to story:', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Delete current story
  const handleDeleteStory = async () => {
    if (!window.confirm('Delete this story?')) return;
    try {
      await deleteStoryApi(currentStory._id);
      // Remove story from local tray state
      const updatedTray = storyTrayUsers.map((cluster) => {
        if (!cluster.isMe) return cluster;
        return {
          ...cluster,
          stories: cluster.stories.filter((s) => s._id !== currentStory._id)
        };
      });

      const myRemaining = updatedTray.find((c) => c.isMe)?.stories || [];
      if (myRemaining.length === 0) {
        closeStoryViewer();
      } else {
        openStoryViewer(updatedTray, activeUserIndex, 0);
      }
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center select-none">
      {/* Background blur desktop wrapper */}
      <div className="relative w-full h-full max-w-md sm:h-[94vh] sm:rounded-3xl overflow-hidden bg-neutral-900 flex flex-col shadow-2xl">
        {/* Top Progress Bars (1 segment per story of current user) */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {currentCluster.stories.map((st, idx) => {
            let fillPct = 0;
            if (idx < activeStoryIndex) fillPct = 100;
            else if (idx === activeStoryIndex) fillPct = progress;
            else fillPct = 0;

            return (
              <div
                key={st._id || idx}
                className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* User Info & Header Controls */}
        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-2">
            <SocialAvatar
              src={currentCluster.user?.avatar}
              alt={currentCluster.user?.name || currentCluster.user?.username}
              size="sm"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">
                {currentCluster.user?.username || currentCluster.user?.name}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-white/80">
                <RelativeTime date={currentStory.createdAt} className="text-white/80" />
                {currentStory.closeFriendsOnly && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white font-bold text-[9px]">
                    Close Friends
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isOwnStory && (
              <button
                type="button"
                onClick={handleDeleteStory}
                className="p-2 rounded-full hover:bg-white/20 transition cursor-pointer"
                title="Delete story"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            )}
            <button
              type="button"
              onClick={closeStoryViewer}
              className="p-2 rounded-full hover:bg-white/20 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Story Media Viewer Canvas */}
        <div
          onClick={handleContentClick}
          onMouseDown={() => setStoryPaused(true)}
          onMouseUp={() => setStoryPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden cursor-pointer"
        >
          {currentStory.media?.type === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.media?.url}
              playsInline
              autoPlay
              muted={false}
              onLoadedMetadata={handleVideoLoadedMetadata}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentStory.media?.url}
              alt="Story"
              className="w-full h-full object-cover"
            />
          )}

          {/* Optional Overlay Text */}
          {currentStory.text && (
            <div className="absolute inset-x-4 bottom-24 p-3 rounded-2xl bg-black/50 backdrop-blur-md text-white text-center text-sm font-medium">
              {currentStory.text}
            </div>
          )}
        </div>

        {/* Bottom Bar: Viewers for own story OR Reply bar for others */}
        <div className="relative z-30 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
          {isOwnStory ? (
            <div className="flex items-center justify-between text-white">
              <button
                type="button"
                onClick={() => setShowViewersSheet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold hover:bg-white/30 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{currentStory.viewers?.length || 0} Viewers</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Quick Emojis */}
              <div className="flex items-center justify-around py-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReply(emoji)}
                    className="text-xl hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply Input Form */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setStoryPaused(true)}
                  onBlur={() => setStoryPaused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendReply();
                  }}
                  placeholder={`Reply to ${currentCluster.user?.username || 'user'}...`}
                  className="flex-1 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md text-white placeholder-white/60 text-xs border border-white/20 focus:outline-hidden focus:border-white"
                />
                <button
                  type="button"
                  disabled={!replyText.trim() || isSendingReply}
                  onClick={() => handleSendReply()}
                  className="w-8 h-8 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white flex items-center justify-center disabled:opacity-50 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Viewers Bottom Sheet for Own Story */}
        <AnimatePresence>
          {showViewersSheet && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-x-0 bottom-0 max-h-[70%] bg-neutral-900 text-white rounded-t-3xl p-4 z-40 flex flex-col border-t border-white/10 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#F97316]" />
                  <span className="text-sm font-bold">
                    Viewers ({currentStory.viewers?.length || 0})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewersSheet(false)}
                  className="p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-3">
                {(!currentStory.viewers || currentStory.viewers.length === 0) && (
                  <p className="text-xs text-white/50 text-center py-6">No views yet.</p>
                )}
                {currentStory.viewers?.map((viewer, i) => (
                  <div key={viewer.user?._id || i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <SocialAvatar
                        src={viewer.user?.avatar}
                        alt={viewer.user?.name || viewer.user?.username}
                        size="sm"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">
                          {viewer.user?.name || viewer.user?.username || 'User'}
                        </span>
                        <span className="text-[10px] text-white/60">
                          @{viewer.user?.username || 'user'}
                        </span>
                      </div>
                    </div>
                    <RelativeTime date={viewer.at} className="text-white/50 text-[10px]" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Toast Notification on Story Reply */}
        <AnimatePresence>
          {replyToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-16 inset-x-4 z-50 p-3 rounded-2xl bg-white text-[#1F2937] shadow-xl flex items-center justify-between gap-3 border border-[#FED7AA]"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">{replyToast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeStoryViewer();
                  navigate(`/chats/${replyToast.conversationId}`);
                }}
                className="px-3 py-1 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer"
              >
                Open Chat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

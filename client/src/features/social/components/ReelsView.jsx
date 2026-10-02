import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreVertical,
  Volume2,
  VolumeX,
  Play,
  Music,
  Plus,
  Check
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSocialStore } from '../store/useSocialStore';
import {
  fetchReelsFeed,
  toggleLikeReelApi,
  toggleSaveReelApi,
  recordReelViewApi
} from '../api/api';
import api from '../../../services/api';
import { SocialAvatar } from './SocialAvatar';

export const ReelsView = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { isMuted, toggleMute, openCommentsSheet, openShareSheet } = useSocialStore();

  const [reels, setReels] = useState([]);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const containerRef = useRef(null);
  const reelRefs = useRef([]);

  // Load initial reels
  const loadReels = async (cursor = null) => {
    try {
      if (!cursor) setLoading(true);
      else setIsFetchingMore(true);

      const res = await fetchReelsFeed({ cursor, limit: 6 });
      if (res.success) {
        const newReels = res.data || [];
        setReels((prev) => (cursor ? [...prev, ...newReels] : newReels));
        setNextCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore));
      }
    } catch (err) {
      console.error('Failed to load reels:', err);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    loadReels();
  }, []);

  // Intersection observer to detect active reel in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index)) {
              setActiveReelIndex(index);

              // Record view count
              const reel = reels[index];
              if (reel?._id) {
                recordReelViewApi(reel._id).catch(() => {});
              }

              // Prefetch more when 2 reels from end
              if (index >= reels.length - 2 && hasMore && nextCursor && !isFetchingMore) {
                loadReels(nextCursor);
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6
      }
    );

    reelRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels, hasMore, nextCursor, isFetchingMore]);

  if (loading) {
    return (
      <div className="w-full max-w-sm mx-auto h-[calc(100dvh-5rem)] rounded-3xl bg-neutral-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-white/70">Loading Reels...</span>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="w-full max-w-sm mx-auto h-[calc(100dvh-5rem)] rounded-3xl bg-neutral-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl mb-3">
          🎬
        </div>
        <h3 className="text-base font-bold">No Reels Yet</h3>
        <p className="text-xs text-white/60 mt-1 max-w-xs">
          Be the first to share a vertical video reel with music, captions, and creative flair!
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-w-sm mx-auto h-[calc(100dvh-5.5rem)] overflow-y-scroll snap-y snap-mandatory no-scrollbar rounded-3xl bg-black relative shadow-2xl"
    >
      {reels.map((reel, index) => {
        const isActive = index === activeReelIndex;
        const isPreload = index === activeReelIndex + 1;

        return (
          <div
            key={reel._id}
            ref={(el) => (reelRefs.current[index] = el)}
            data-index={index}
            className="w-full h-full snap-start relative flex items-center justify-center bg-black overflow-hidden"
          >
            <ReelCard
              reel={reel}
              isActive={isActive}
              isPreload={isPreload}
              isMuted={isMuted}
              toggleMute={toggleMute}
              openCommentsSheet={openCommentsSheet}
              openShareSheet={openShareSheet}
              currentUserId={currentUser?._id}
            />
          </div>
        );
      })}
    </div>
  );
};

// Sub-component for individual snap reel
const ReelCard = ({
  reel,
  isActive,
  isPreload,
  isMuted,
  toggleMute,
  openCommentsSheet,
  openShareSheet,
  currentUserId
}) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(Boolean(reel.isLiked));
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [isSaved, setIsSaved] = useState(Boolean(reel.isSaved));
  const [isFollowing, setIsFollowing] = useState(Boolean(reel.author?.isFollowing));
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  const isMe = String(reel.author?._id) === String(currentUserId);

  // Play / pause active reel
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(pct);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleToggleLike = async () => {
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      const res = await toggleLikeReelApi(reel._id);
      if (res.success) {
        setIsLiked(res.liked);
        if (res.likesCount !== undefined) setLikesCount(res.likesCount);
      }
    } catch (err) {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleToggleSave = async () => {
    const prevSaved = isSaved;
    setIsSaved(!prevSaved);
    try {
      const res = await toggleSaveReelApi(reel._id);
      if (res.success) {
        setIsSaved(res.saved);
      }
    } catch (err) {
      setIsSaved(prevSaved);
    }
  };

  const handleFollowToggle = async () => {
    try {
      setIsFollowing(true);
      await api.post(`/follow/${reel.author._id}`);
    } catch (err) {
      console.error('Follow failed:', err);
    }
  };

  const handleOpenShare = () => {
    const snapshot = {
      thumbnail: reel.media?.thumbnail || reel.media?.url || '',
      authorUsername: reel.author?.username || 'user',
      authorName: reel.author?.name || 'User',
      authorAvatar: reel.author?.avatar || '',
      captionSnippet: reel.caption?.slice(0, 100) || '',
      mediaType: 'video'
    };
    openShareSheet('reel', reel._id, snapshot);
  };

  return (
    <div className="relative w-full h-full bg-neutral-900 overflow-hidden select-none" onClick={togglePlay}>
      {/* Video Element */}
      <video
        ref={videoRef}
        src={reel.media?.url}
        poster={reel.media?.thumbnail}
        loop
        playsInline
        muted={isMuted}
        preload={isPreload || isActive ? 'auto' : 'none'}
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-full object-cover"
      />

      {/* Tap pause indicator */}
      {!isPlaying && isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
            <Play className="w-8 h-8 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Top Controls: Mute toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Right Action Rail */}
      <div className="absolute right-3 bottom-14 z-20 flex flex-col items-center gap-4 text-white">
        {/* Like */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleLike();
          }}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-90 transition">
            <Heart
              className={`w-6 h-6 ${
                isLiked ? 'fill-[#F43F5E] text-[#F43F5E]' : 'text-white'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold drop-shadow-md">{likesCount}</span>
        </button>

        {/* Comment */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCommentsSheet('reel', reel._id, reel.author?._id);
          }}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-90 transition">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-[11px] font-bold drop-shadow-md">
            {reel.commentsCount || 0}
          </span>
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenShare();
          }}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-90 transition">
            <Send className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] font-semibold drop-shadow-md">Share</span>
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleSave();
          }}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-90 transition">
            <Bookmark
              className={`w-5 h-5 ${
                isSaved ? 'fill-[#F97316] text-[#F97316]' : 'text-white'
              }`}
            />
          </div>
        </button>

        {/* More / Copy link */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(`${window.location.origin}/social/reels`);
            alert('Reel link copied!');
          }}
          className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition cursor-pointer"
        >
          <MoreVertical className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Bottom Overlay Info (Author, Follow, Caption, Audio) */}
      <div className="absolute left-3 right-16 bottom-4 z-20 text-white space-y-2">
        {/* Author + Follow button */}
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/u/${reel.author?.username}`);
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <SocialAvatar
              src={reel.author?.avatar}
              alt={reel.author?.name || reel.author?.username}
              size="sm"
            />
            <span className="text-xs font-bold drop-shadow-md">
              @{reel.author?.username || 'user'}
            </span>
          </div>

          {!isMe && !isFollowing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFollowToggle();
              }}
              className="px-2.5 py-0.5 rounded-full border border-white/80 bg-white/10 backdrop-blur-md text-white text-[11px] font-bold hover:bg-white hover:text-black transition cursor-pointer"
            >
              Follow
            </button>
          )}
        </div>

        {/* Caption */}
        {reel.caption && (
          <div className="text-xs leading-snug drop-shadow-md">
            <p className={isCaptionExpanded ? '' : 'line-clamp-2'}>
              {reel.caption}
            </p>
            {reel.caption.length > 80 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCaptionExpanded(!isCaptionExpanded);
                }}
                className="text-[11px] text-white/70 font-semibold cursor-pointer"
              >
                {isCaptionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Audio ticker */}
        <div className="flex items-center gap-1.5 text-[11px] text-white/90">
          <Music className="w-3.5 h-3.5 text-[#F97316] animate-pulse" />
          <span className="truncate max-w-[160px] font-medium">
            {reel.audioName || 'Original Audio - Flash Chat'}
          </span>
        </div>
      </div>

      {/* Progress Bar at very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div
          className="h-full bg-gradient-to-r from-[#F97316] to-[#EC4899] transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

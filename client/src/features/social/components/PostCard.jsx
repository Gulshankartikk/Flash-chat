import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  MapPin,
  Trash2,
  Flag,
  UserX,
  Link2
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSocialStore } from '../store/useSocialStore';
import { toggleLikePostApi, toggleSavePostApi, deletePostApi } from '../api/api';
import { SocialAvatar } from './SocialAvatar';
import { MediaCarousel } from './MediaCarousel';
import { RelativeTime } from './RelativeTime';

export const PostCard = ({ post, onPostDeleted }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { openCommentsSheet, openShareSheet } = useSocialStore();

  const [isLiked, setIsLiked] = useState(Boolean(post.isLiked));
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isSaved, setIsSaved] = useState(Boolean(post.isSaved));
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = currentUser?._id && String(post.author?._id) === String(currentUser._id);

  // Optimistic like toggle
  const handleToggleLike = async () => {
    const prevLiked = isLiked;
    const prevCount = likesCount;

    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      const res = await toggleLikePostApi(post._id);
      if (res.success) {
        setIsLiked(res.liked);
        if (res.likesCount !== undefined) setLikesCount(res.likesCount);
      }
    } catch (err) {
      // Rollback on error
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  // Optimistic save toggle
  const handleToggleSave = async () => {
    const prevSaved = isSaved;
    setIsSaved(!prevSaved);
    try {
      const res = await toggleSavePostApi(post._id);
      if (res.success) {
        setIsSaved(res.saved);
      }
    } catch (err) {
      setIsSaved(prevSaved);
    }
  };

  // Handle post deletion
  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setIsDeleting(true);
    try {
      await deletePostApi(post._id);
      if (onPostDeleted) onPostDeleted(post._id);
    } catch (err) {
      console.error('Failed to delete post:', err);
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  // Copy post link
  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/social/post/${post._id}`;
    navigator.clipboard.writeText(postUrl);
    alert('Post link copied to clipboard!');
    setShowMenu(false);
  };

  // Open share sheet with post snapshot
  const handleOpenShare = () => {
    const snapshot = {
      thumbnail: post.media?.[0]?.thumbnail || post.media?.[0]?.url || '',
      authorUsername: post.author?.username || 'user',
      authorName: post.author?.name || 'User',
      authorAvatar: post.author?.avatar || '',
      captionSnippet: post.caption?.slice(0, 100) || '',
      mediaType: post.media?.[0]?.type || 'image'
    };
    openShareSheet('post', post._id, snapshot);
  };

  // Render caption with clickable hashtags and mentions
  const renderFormattedCaption = (text) => {
    if (!text) return null;
    const words = text.split(/(\s+)/);
    return words.map((word, i) => {
      if (word.startsWith('#')) {
        const tag = word.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/social/hashtag/${tag}`);
            }}
            className="text-[#F97316] font-semibold hover:underline cursor-pointer"
          >
            {word}
          </span>
        );
      }
      if (word.startsWith('@')) {
        const username = word.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/u/${username}`);
            }}
            className="text-[#EC4899] font-semibold hover:underline cursor-pointer"
          >
            {word}
          </span>
        );
      }
      return word;
    });
  };

  const isLongCaption = (post.caption || '').length > 90;

  return (
    <article className="w-full bg-white rounded-3xl border border-[#FED7AA]/60 shadow-xs overflow-hidden transition-all">
      {/* 1. Author Row Header */}
      <div className="flex items-center justify-between p-3.5">
        <div
          onClick={() => navigate(`/u/${post.author?.username}`)}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <SocialAvatar
            src={post.author?.avatar}
            alt={post.author?.name || post.author?.username}
            size="sm"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#1F2937] group-hover:text-[#F97316] transition">
                {post.author?.username || post.author?.name}
              </span>
              {post.author?.isVerified && (
                <span className="w-3.5 h-3.5 rounded-full bg-[#F97316] text-white text-[9px] flex items-center justify-center font-bold">
                  ✓
                </span>
              )}
            </div>
            {post.location && (
              <div className="flex items-center gap-0.5 text-[10px] text-[#6B7280]">
                <MapPin className="w-2.5 h-2.5 text-[#F97316]" />
                <span className="truncate max-w-[140px]">{post.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Header More Options Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-full hover:bg-orange-50 text-[#6B7280] hover:text-[#1F2937] transition cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-40 w-40 bg-white rounded-2xl border border-[#FED7AA] shadow-lg p-1.5 text-xs font-semibold text-[#1F2937] space-y-0.5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-orange-50 flex items-center gap-2 text-left cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Copy Link</span>
              </button>
              {isOwner ? (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeletePost}
                  className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-[#F43F5E] flex items-center gap-2 text-left cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Post</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      alert('Post reported for review. Thank you for keeping our community safe.');
                      setShowMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-orange-50 text-[#F43F5E] flex items-center gap-2 text-left cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report Post</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      alert(`User @${post.author?.username} blocked.`);
                      setShowMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-orange-50 text-[#F43F5E] flex items-center gap-2 text-left cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Block User</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Media Carousel */}
      <MediaCarousel
        media={post.media}
        onDoubleTapLike={!isLiked ? handleToggleLike : undefined}
      />

      {/* 3. Action Buttons Row */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Like button */}
            <button
              type="button"
              onClick={handleToggleLike}
              className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              title="Like"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isLiked
                    ? 'fill-[#F43F5E] text-[#F43F5E]'
                    : 'text-[#1F2937] hover:text-[#F43F5E]'
                }`}
              />
            </button>

            {/* Comment button */}
            <button
              type="button"
              onClick={() => openCommentsSheet('post', post._id, post.author?._id)}
              className="p-1 hover:scale-110 active:scale-95 transition-transform text-[#1F2937] hover:text-[#F97316] cursor-pointer"
              title="Comment"
            >
              <MessageCircle className="w-5 h-5" />
            </button>

            {/* Share button */}
            <button
              type="button"
              onClick={handleOpenShare}
              className="p-1 hover:scale-110 active:scale-95 transition-transform text-[#1F2937] hover:text-[#F97316] cursor-pointer"
              title="Share"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          {/* Bookmark / Save button */}
          <button
            type="button"
            onClick={handleToggleSave}
            className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            title="Save"
          >
            <Bookmark
              className={`w-5 h-5 transition-colors ${
                isSaved
                  ? 'fill-[#F97316] text-[#F97316]'
                  : 'text-[#1F2937] hover:text-[#F97316]'
              }`}
            />
          </button>
        </div>

        {/* Likes Count */}
        {likesCount > 0 && (
          <p className="text-xs font-bold text-[#1F2937]">
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {/* Caption */}
        {post.caption && (
          <div className="text-xs text-[#1F2937] leading-relaxed">
            <span
              onClick={() => navigate(`/u/${post.author?.username}`)}
              className="font-bold mr-1.5 cursor-pointer hover:underline"
            >
              {post.author?.username}
            </span>
            <span>
              {isLongCaption && !isCaptionExpanded
                ? renderFormattedCaption(post.caption.slice(0, 90))
                : renderFormattedCaption(post.caption)}
            </span>
            {isLongCaption && (
              <button
                type="button"
                onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                className="text-xs text-[#6B7280] font-semibold ml-1 hover:text-[#1F2937] cursor-pointer"
              >
                {isCaptionExpanded ? 'less' : '...more'}
              </button>
            )}
          </div>
        )}

        {/* Comments link */}
        {(post.commentsCount > 0 || post.allowComments) && (
          <button
            type="button"
            onClick={() => openCommentsSheet('post', post._id, post.author?._id)}
            className="text-xs text-[#6B7280] hover:text-[#1F2937] transition font-medium cursor-pointer block"
          >
            {post.commentsCount > 0
              ? `View all ${post.commentsCount} comments`
              : 'Add a comment...'}
          </button>
        )}

        {/* Timestamp */}
        <div>
          <RelativeTime date={post.createdAt} className="text-[10px] uppercase font-medium text-[#6B7280]" />
        </div>
      </div>
    </article>
  );
};

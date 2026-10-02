import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Trash2,
  Send,
  Smile,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSocialStore } from '../store/useSocialStore';
import { BottomSheet } from '../../../components/BottomSheet';
import { SocialAvatar } from './SocialAvatar';
import { RelativeTime } from './RelativeTime';
import {
  fetchComments,
  createCommentApi,
  fetchCommentReplies,
  deleteCommentApi,
  toggleLikeCommentApi,
  searchSocialApi
} from '../api/api';

const EMOJI_LIST = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '✨', '😂'];

export const CommentsSheet = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { commentsSheet, closeCommentsSheet } = useSocialStore();
  const { isOpen, targetType, targetId, targetOwnerId } = commentsSheet;

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Input state
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { id, username }
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Autocomplete
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);

  const inputRef = useRef(null);
  const commentsEndRef = useRef(null);

  // Load top-level comments
  const loadComments = useCallback(
    async (cursor = null) => {
      if (!targetId) return;
      try {
        if (!cursor) setLoading(true);
        const res = await fetchComments({ targetType, targetId, cursor, limit: 20 });
        if (res.success) {
          const newComments = (res.data || []).map((c) => ({
            ...c,
            replies: [],
            repliesLoaded: false,
            repliesOpen: false
          }));
          setComments((prev) => (cursor ? [...prev, ...newComments] : newComments));
          setNextCursor(res.nextCursor || null);
          setHasMore(Boolean(res.hasMore));
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
      } finally {
        setLoading(false);
      }
    },
    [targetType, targetId]
  );

  useEffect(() => {
    if (isOpen && targetId) {
      setComments([]);
      setReplyingTo(null);
      setText('');
      loadComments();
    }
  }, [isOpen, targetId, loadComments]);

  // Handle typing with @ mention autocomplete
  const handleTextChange = async (e) => {
    const val = e.target.value;
    if (val.length > 500) return;
    setText(val);

    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const words = textBefore.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const q = lastWord.slice(1);
      setMentionQuery(q);
      try {
        const res = await searchSocialApi({ q, type: 'users' });
        if (res.success) setUserSuggestions(res.data || []);
      } catch (err) {}
    } else {
      setMentionQuery(null);
      setUserSuggestions([]);
    }
  };

  const handleSelectMention = (username) => {
    const words = text.split(/\s+/);
    words.pop();
    setText(`${words.join(' ')} @${username} `.trimStart());
    setMentionQuery(null);
    setUserSuggestions([]);
    inputRef.current?.focus();
  };

  // Add Comment (Optimistic)
  const handleSubmitComment = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || submitting) return;

    const commentText = text.trim();
    const parentId = replyingTo?.id || null;
    const tempId = `temp_${Date.now()}`;

    const tempComment = {
      _id: tempId,
      text: commentText,
      author: {
        _id: currentUser._id,
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
        isVerified: currentUser.isVerified
      },
      createdAt: new Date().toISOString(),
      likesCount: 0,
      isLiked: false,
      repliesCount: 0,
      parent: parentId,
      replies: [],
      repliesLoaded: false,
      repliesOpen: false
    };

    // Optimistically update
    if (parentId) {
      setComments((prev) =>
        prev.map((c) => {
          if (c._id === parentId) {
            return {
              ...c,
              repliesCount: (c.repliesCount || 0) + 1,
              replies: [...(c.replies || []), tempComment],
              repliesOpen: true
            };
          }
          return c;
        })
      );
    } else {
      setComments((prev) => [tempComment, ...prev]);
    }

    setText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setSubmitting(true);

    try {
      const res = await createCommentApi({
        targetType,
        targetId,
        text: commentText,
        parentId
      });

      if (res.success && res.data) {
        // Replace temp comment with confirmed doc from server
        const confirmed = res.data;
        if (parentId) {
          setComments((prev) =>
            prev.map((c) => {
              if (c._id === parentId) {
                return {
                  ...c,
                  replies: (c.replies || []).map((r) => (r._id === tempId ? confirmed : r))
                };
              }
              return c;
            })
          );
        } else {
          setComments((prev) =>
            prev.map((c) => (c._id === tempId ? { ...confirmed, replies: [] } : c))
          );
        }
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
      // Rollback on error
      if (parentId) {
        setComments((prev) =>
          prev.map((c) => {
            if (c._id === parentId) {
              return {
                ...c,
                repliesCount: Math.max((c.repliesCount || 1) - 1, 0),
                replies: (c.replies || []).filter((r) => r._id !== tempId)
              };
            }
            return c;
          })
        );
      } else {
        setComments((prev) => prev.filter((c) => c._id !== tempId));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Like / Unlike comment
  const handleToggleLike = async (commentId, isReply = false, parentId = null) => {
    // Find comment
    let currentLiked = false;
    if (!isReply) {
      const target = comments.find((c) => c._id === commentId);
      currentLiked = Boolean(target?.isLiked);
      setComments((prev) =>
        prev.map((c) => {
          if (c._id === commentId) {
            return {
              ...c,
              isLiked: !currentLiked,
              likesCount: currentLiked ? c.likesCount - 1 : c.likesCount + 1
            };
          }
          return c;
        })
      );
    } else {
      const parent = comments.find((c) => c._id === parentId);
      const target = parent?.replies?.find((r) => r._id === commentId);
      currentLiked = Boolean(target?.isLiked);
      setComments((prev) =>
        prev.map((c) => {
          if (c._id === parentId) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r._id === commentId
                  ? {
                      ...r,
                      isLiked: !currentLiked,
                      likesCount: currentLiked ? r.likesCount - 1 : r.likesCount + 1
                    }
                  : r
              )
            };
          }
          return c;
        })
      );
    }

    try {
      await toggleLikeCommentApi(commentId, currentLiked);
    } catch (err) {
      // Revert if error
      console.error('Failed to like comment:', err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId, isReply = false, parentId = null) => {
    if (!window.confirm('Delete this comment?')) return;

    if (!isReply) {
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } else {
      setComments((prev) =>
        prev.map((c) => {
          if (c._id === parentId) {
            return {
              ...c,
              repliesCount: Math.max((c.repliesCount || 1) - 1, 0),
              replies: (c.replies || []).filter((r) => r._id !== commentId)
            };
          }
          return c;
        })
      );
    }

    try {
      await deleteCommentApi(commentId);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Toggle & Load replies (1 level of nesting)
  const handleToggleReplies = async (parentComment) => {
    const isCurrentlyOpen = Boolean(parentComment.repliesOpen);

    if (isCurrentlyOpen) {
      setComments((prev) =>
        prev.map((c) => (c._id === parentComment._id ? { ...c, repliesOpen: false } : c))
      );
      return;
    }

    if (parentComment.repliesLoaded) {
      setComments((prev) =>
        prev.map((c) => (c._id === parentComment._id ? { ...c, repliesOpen: true } : c))
      );
      return;
    }

    // Load replies from backend
    try {
      const res = await fetchCommentReplies(parentComment._id);
      if (res.success) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === parentComment._id
              ? {
                  ...c,
                  replies: res.data || [],
                  repliesLoaded: true,
                  repliesOpen: true
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to fetch replies:', err);
    }
  };

  // Render text with clickable #hashtags and @mentions
  const renderRichText = (str) => {
    if (!str) return null;
    return str.split(/(\s+)/).map((word, idx) => {
      if (word.startsWith('@')) {
        const u = word.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
        return (
          <span
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              closeCommentsSheet();
              navigate(`/u/${u}`);
            }}
            className="text-[#EC4899] font-bold hover:underline cursor-pointer"
          >
            {word}
          </span>
        );
      }
      if (word.startsWith('#')) {
        const t = word.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
        return (
          <span
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              closeCommentsSheet();
              navigate(`/social/hashtag/${t}`);
            }}
            className="text-[#F97316] font-bold hover:underline cursor-pointer"
          >
            {word}
          </span>
        );
      }
      return word;
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={closeCommentsSheet} title="Comments">
      <div className="flex flex-col h-[70vh] sm:h-[60vh] bg-white">
        {/* Comment list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && comments.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[#FED7AA]/40" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-24 h-2.5 rounded-full bg-[#FED7AA]/40" />
                    <div className="w-48 h-2 rounded-full bg-[#FED7AA]/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6B7280]">
              <MessageSquare className="w-10 h-10 stroke-1 text-[#FED7AA] mb-2" />
              <p className="text-xs font-bold text-[#1F2937]">No comments yet</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Start the conversation!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const canDelete =
                String(comment.author?._id) === String(currentUser?._id) ||
                String(targetOwnerId) === String(currentUser?._id);

              return (
                <div key={comment._id} className="space-y-2">
                  {/* Top level comment row */}
                  <div className="flex items-start justify-between gap-3 group">
                    <div className="flex items-start gap-2.5 flex-1">
                      <SocialAvatar
                        src={comment.author?.avatar}
                        alt={comment.author?.username}
                        size="sm"
                        onClick={() => {
                          closeCommentsSheet();
                          navigate(`/u/${comment.author?.username}`);
                        }}
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex items-baseline gap-1.5">
                          <span
                            onClick={() => {
                              closeCommentsSheet();
                              navigate(`/u/${comment.author?.username}`);
                            }}
                            className="font-bold text-[#1F2937] hover:text-[#F97316] cursor-pointer"
                          >
                            {comment.author?.username}
                          </span>
                          <RelativeTime date={comment.createdAt} className="text-[10px]" />
                        </div>
                        <p className="text-[#1F2937] mt-0.5 leading-relaxed break-words">
                          {renderRichText(comment.text)}
                        </p>

                        {/* Reply & Delete actions */}
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold text-[#6B7280]">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo({
                                id: comment._id,
                                username: comment.author?.username
                              });
                              inputRef.current?.focus();
                            }}
                            className="hover:text-[#F97316] cursor-pointer"
                          >
                            Reply
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment._id, false)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Like button for comment */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(comment._id, false)}
                      className="flex flex-col items-center gap-0.5 text-[#6B7280] hover:text-[#F43F5E] p-1 cursor-pointer"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          comment.isLiked ? 'fill-[#F43F5E] text-[#F43F5E]' : ''
                        }`}
                      />
                      {comment.likesCount > 0 && (
                        <span className="text-[9px] font-bold">{comment.likesCount}</span>
                      )}
                    </button>
                  </div>

                  {/* "View N replies" accordion button */}
                  {comment.repliesCount > 0 && (
                    <div className="ml-10">
                      <button
                        type="button"
                        onClick={() => handleToggleReplies(comment)}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] hover:text-[#F97316] cursor-pointer"
                      >
                        <div className="w-5 h-[1px] bg-[#FED7AA]" />
                        <span>
                          {comment.repliesOpen
                            ? 'Hide replies'
                            : `View all ${comment.repliesCount} ${
                                comment.repliesCount === 1 ? 'reply' : 'replies'
                              }`}
                        </span>
                        {comment.repliesOpen ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {/* 1 level nested replies list */}
                      {comment.repliesOpen && (
                        <div className="mt-2 space-y-3 pl-2 border-l border-[#FED7AA]/60">
                          {comment.replies?.map((reply) => {
                            const canDeleteReply =
                              String(reply.author?._id) === String(currentUser?._id) ||
                              String(targetOwnerId) === String(currentUser?._id);

                            return (
                              <div
                                key={reply._id}
                                className="flex items-start justify-between gap-3"
                              >
                                <div className="flex items-start gap-2 flex-1">
                                  <SocialAvatar
                                    src={reply.author?.avatar}
                                    alt={reply.author?.username}
                                    size="xs"
                                  />
                                  <div className="flex-1 text-xs">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="font-bold text-[#1F2937]">
                                        {reply.author?.username}
                                      </span>
                                      <RelativeTime date={reply.createdAt} className="text-[9px]" />
                                    </div>
                                    <p className="text-[#1F2937] mt-0.5 leading-relaxed break-words">
                                      {renderRichText(reply.text)}
                                    </p>
                                    {canDeleteReply && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteComment(reply._id, true, comment._id)
                                        }
                                        className="text-[10px] text-rose-500 font-semibold mt-1 hover:underline cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleLike(reply._id, true, comment._id)
                                  }
                                  className="flex flex-col items-center gap-0.5 text-[#6B7280] hover:text-[#F43F5E] p-1 cursor-pointer"
                                >
                                  <Heart
                                    className={`w-3 h-3 ${
                                      reply.isLiked ? 'fill-[#F43F5E] text-[#F43F5E]' : ''
                                    }`}
                                  />
                                  {reply.likesCount > 0 && (
                                    <span className="text-[9px] font-bold">
                                      {reply.likesCount}
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Autocomplete Popup */}
        {mentionQuery && userSuggestions.length > 0 && (
          <div className="px-4 py-2 border-t border-[#FED7AA]/50 bg-white max-h-32 overflow-y-auto space-y-1">
            {userSuggestions.map((u) => (
              <div
                key={u._id}
                onClick={() => handleSelectMention(u.username)}
                className="p-1.5 rounded-xl hover:bg-orange-50 flex items-center gap-2 text-xs font-semibold cursor-pointer"
              >
                <SocialAvatar src={u.avatar} alt={u.username} size="xs" />
                <span className="text-[#EC4899]">@{u.username}</span>
                <span className="text-[10px] text-[#6B7280]">{u.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sticky Input Footer */}
        <div className="p-3 border-t border-[#FED7AA]/60 bg-[#FFF7ED]/30 space-y-2">
          {/* Replying-to chip */}
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-1 rounded-full bg-orange-100 text-xs text-[#1F2937]">
              <span>
                Replying to <span className="font-bold text-[#F97316]">@{replyingTo.username}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-0.5 hover:bg-orange-200 rounded-full cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick Emoji bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setText((prev) => (prev + emoji).slice(0, 500))}
                  className="text-base hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-[#6B7280] font-semibold">{text.length}/500</span>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={handleTextChange}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
              className="flex-1 px-4 py-2 rounded-full border border-[#FED7AA] bg-white text-xs text-[#1F2937] placeholder-[#6B7280] focus:outline-hidden focus:border-[#F97316]"
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <Send className="w-3 h-3" />
              <span>Post</span>
            </button>
          </form>
        </div>
      </div>
    </BottomSheet>
  );
};

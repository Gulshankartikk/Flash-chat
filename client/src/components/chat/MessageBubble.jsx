import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Check,
  CheckCheck,
  Reply,
  Forward,
  Star,
  Copy,
  Edit3,
  Trash2,
  FileText,
  Download,
  MapPin,
  Phone,
  Bookmark,
  Play,
  Pause,
  Smile,
  MoreHorizontal,
  Sparkles,
  Film,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { PostViewerModal } from '../../features/social/components/PostViewerModal';
import { useSocialStore } from '../../features/social/store/useSocialStore';
import { fetchStoriesTray } from '../../features/social/api/api';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🙏'];

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
  isGroup,
  currentUserId,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReact,
  onStar,
  onSaveToPocket
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioElement, setAudioElement] = useState(null);

  const formattedTime = message.createdAt
    ? format(new Date(message.createdAt), 'h:mm a')
    : '';

  // Receipts status
  const isRead = message.readBy && message.readBy.length > 1;
  const isDelivered = message.deliveredTo && message.deliveredTo.length > 1;

  // Starred by current user
  const isStarred = Array.isArray(message.starredBy) && message.starredBy.includes(currentUserId);

  // Group reactions by emoji: { [emoji]: count }
  const reactionCounts = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
    }
  };

  const handleAudioToggle = (url) => {
    if (isPlayingAudio && audioElement) {
      audioElement.pause();
      setIsPlayingAudio(false);
    } else {
      const audio = audioElement || new Audio(url);
      audio.onended = () => setIsPlayingAudio(false);
      audio.play();
      setAudioElement(audio);
      setIsPlayingAudio(true);
    }
  };

  const navigate = useNavigate();
  const { openStoryViewer } = useSocialStore();
  const [activeViewerPostId, setActiveViewerPostId] = useState(null);
  const [contentError, setContentError] = useState(null);

  const isSharedContent =
    message.type === 'shared_post' ||
    message.type === 'shared_reel' ||
    message.type === 'shared_story' ||
    message.type === 'shared_profile';

  const isStoryReply = message.type === 'shared_story' && Boolean(message.text);

  const handleOpenShared = async (e) => {
    e.stopPropagation();
    setContentError(null);

    const kind = message.sharedRef?.kind || message.type.replace('shared_', '');
    const refId = message.sharedRef?.refId;

    if (kind === 'profile' || message.type === 'shared_profile') {
      const username = message.snapshot?.authorUsername;
      if (username) navigate(`/u/${username}`);
      return;
    }

    if (kind === 'reel' || message.type === 'shared_reel') {
      navigate('/social/reels');
      return;
    }

    if (kind === 'post' || message.type === 'shared_post') {
      if (refId) {
        setActiveViewerPostId(refId);
      }
      return;
    }

    if (kind === 'story' || message.type === 'shared_story') {
      try {
        const trayRes = await fetchStoriesTray();
        if (trayRes.success && trayRes.data) {
          const userIndex = trayRes.data.findIndex((u) =>
            u.stories?.some((s) => String(s._id) === String(refId))
          );
          if (userIndex >= 0) {
            const storyIdx = trayRes.data[userIndex].stories.findIndex(
              (s) => String(s._id) === String(refId)
            );
            openStoryViewer(trayRes.data, userIndex, Math.max(storyIdx, 0));
          } else {
            setContentError('This story is no longer available (stories expire after 24h).');
            setTimeout(() => setContentError(null), 4000);
          }
        }
      } catch (err) {
        setContentError('This story is no longer available.');
        setTimeout(() => setContentError(null), 4000);
      }
    }
  };

  // Deleted message rendering
  if (message.deletedForEveryone) {
    return (
      <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-1 px-2`}>
        <div className="px-4 py-2 rounded-2xl bg-orange-50/60 text-[#6B7280] text-xs italic border border-[#FED7AA]/60">
          🚫 This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmojiPicker(false);
      }}
      className={`relative flex items-end gap-2 my-1.5 px-2 group w-full ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Sender Avatar for received group messages */}
      {!isOwn && (
        <Avatar
          src={message.sender?.avatar}
          alt={message.sender?.name}
          size="sm"
          className="mb-1"
        />
      )}

      {/* Floating Hover Action Bar (Left of bubble if own, right if received) */}
      <div
        className={`absolute top-0 z-20 transition-opacity duration-150 flex items-center gap-1 bg-white border border-[#FED7AA] shadow-md rounded-2xl p-1 text-[#6B7280] ${
          showActions ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } ${isOwn ? 'right-[calc(100%-80px)] md:right-[60%]' : 'left-[70%] md:left-[55%]'}`}
      >
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-1 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
          title="React"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onReply && onReply(message)}
          className="p-1 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
          title="Reply"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onForward && onForward(message)}
          className="p-1 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
          title="Forward"
        >
          <Forward className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onStar && onStar(message._id)}
          className={`p-1 hover:bg-orange-50 rounded-lg transition ${
            isStarred ? 'text-amber-500 fill-amber-500' : 'hover:text-amber-500'
          }`}
          title={isStarred ? 'Unstar' : 'Star'}
        >
          <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} />
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="p-1 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
          title="Copy Text"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {isOwn && (
          <>
            <button
              type="button"
              onClick={() => onEdit && onEdit(message)}
              className="p-1 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
              title="Edit (within 15m)"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDelete && onDelete(message._id, 'everyone')}
              className="p-1 hover:text-[#F43F5E] hover:bg-rose-50 rounded-lg transition"
              title="Delete for everyone"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Quick Emoji Reaction Palette Dropdown */}
      {showEmojiPicker && (
        <div
          className={`absolute top-[-36px] z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-[#FED7AA] shadow-xl text-base ${
            isOwn ? 'right-12' : 'left-12'
          }`}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact && onReact(message._id, emoji);
                setShowEmojiPicker(false);
              }}
              className="hover:scale-125 transition transform p-0.5 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Bubble Container */}
      <div className="relative max-w-[85%] sm:max-w-[70%]">
        {/* Sender Name in group chats */}
        {!isOwn && isGroup && (
          <p className="text-[11px] font-bold text-[#F97316] ml-2 mb-1">
            {message.sender?.name || message.sender?.username}
          </p>
        )}

        {/* Forwarded Header */}
        {message.forwardedFrom && (
          <div className="flex items-center gap-1 text-[10px] text-[#6B7280] italic ml-2 mb-0.5">
            <Forward className="w-3 h-3 text-[#F97316]" />
            <span>Forwarded</span>
          </div>
        )}

        {/* Main Bubble Card */}
        <div
          className={`relative rounded-3xl px-4 py-2.5 shadow-sm text-sm break-words transition ${
            isOwn
              ? 'bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white rounded-br-xs shadow-orange-500/10'
              : 'bg-white text-[#1F2937] border border-[#FED7AA] rounded-bl-xs'
          }`}
        >
          {/* Quoted Reply Preview Bar */}
          {message.replyTo && (
            <div
              className={`mb-2 p-2 rounded-xl text-xs border-l-4 overflow-hidden ${
                isOwn
                  ? 'bg-white/15 border-white text-white/90'
                  : 'bg-orange-50/70 border-[#F97316] text-[#6B7280]'
              }`}
            >
              <p className="font-bold text-[11px] text-[#F97316]">
                {message.replyTo.sender?.name || 'Reply'}
              </p>
              <p className="truncate text-[11px] mt-0.5">
                {message.replyTo.text || 'Attachment'}
              </p>
            </div>
          )}

          {/* Story Reply Preview Header */}
          {isStoryReply && message.snapshot && (
            <div
              onClick={handleOpenShared}
              className={`mb-2 p-2 rounded-2xl flex items-center gap-2.5 cursor-pointer transition ${
                isOwn
                  ? 'bg-white/20 hover:bg-white/30 text-white'
                  : 'bg-orange-50 hover:bg-orange-100 text-[#1F2937]'
              }`}
            >
              {message.snapshot.thumbnail && (
                <img
                  src={message.snapshot.thumbnail}
                  alt="Story preview"
                  className="w-10 h-10 rounded-xl object-cover border border-white/20"
                />
              )}
              <div className="flex-1 min-w-0 text-xs">
                <div className="flex items-center gap-1 font-bold text-[10px] text-[#F97316]">
                  <Sparkles className="w-3 h-3" />
                  <span>Replied to story</span>
                </div>
                <p className="truncate text-[11px] opacity-80">
                  {message.snapshot.authorUsername
                    ? `@${message.snapshot.authorUsername}`
                    : 'Story'}
                </p>
              </div>
            </div>
          )}

          {/* Social Shared Content Card (post, reel, story share, profile) */}
          {isSharedContent && !isStoryReply && message.snapshot && (
            <div
              onClick={handleOpenShared}
              className={`mb-2 rounded-2xl overflow-hidden cursor-pointer transition select-none ${
                isOwn
                  ? 'bg-white/15 text-white hover:bg-white/20'
                  : 'bg-[#FFF7ED] text-[#1F2937] hover:bg-orange-100/60 border border-[#FED7AA]/60'
              }`}
            >
              {/* Header */}
              <div className="flex items-center gap-2 p-2.5">
                <Avatar
                  src={message.snapshot.authorAvatar}
                  alt={message.snapshot.authorUsername}
                  size="xs"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">
                    @{message.snapshot.authorUsername || 'user'}
                  </p>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-75 px-1.5 py-0.5 rounded-full bg-black/10">
                  {message.type === 'shared_post'
                    ? 'Post'
                    : message.type === 'shared_reel'
                    ? 'Reel'
                    : message.type === 'shared_story'
                    ? 'Story'
                    : 'Profile'}
                </span>
              </div>

              {/* Media Thumbnail */}
              {message.snapshot.thumbnail && (
                <div className="relative aspect-video sm:aspect-square max-h-56 w-full overflow-hidden bg-black/40">
                  <img
                    src={message.snapshot.thumbnail}
                    alt="Shared content preview"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {(message.type === 'shared_reel' ||
                    message.snapshot.mediaType === 'video') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Caption snippet */}
              {message.snapshot.captionSnippet && (
                <div className="p-2.5 text-xs">
                  <p className="line-clamp-2 leading-relaxed opacity-90">
                    {message.snapshot.captionSnippet}
                  </p>
                </div>
              )}

              {/* Profile Card Action */}
              {message.type === 'shared_profile' && (
                <div className="p-2.5 pt-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (message.snapshot.authorUsername) {
                        navigate(`/u/${message.snapshot.authorUsername}`);
                      }
                    }}
                    className="w-full py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold text-center shadow-xs cursor-pointer"
                  >
                    View Profile
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Expired / Unavailable Banner */}
          {contentError && (
            <div className="mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{contentError}</span>
            </div>
          )}

          {/* Media Attachments */}
          {message.media && message.media.length > 0 && (
            <div className="space-y-2 mb-2">
              {message.media.map((med, idx) => {
                if (med.mimeType?.startsWith('image/') || message.type === 'image') {
                  return (
                    <div key={idx} className="rounded-2xl overflow-hidden border border-black/10">
                      <a href={med.url} target="_blank" rel="noreferrer">
                        <img
                          src={med.url}
                          alt="Media attachment"
                          loading="lazy"
                          className="max-h-72 w-full object-cover hover:scale-[1.02] transition duration-200"
                        />
                      </a>
                    </div>
                  );
                }

                if (med.mimeType?.startsWith('video/') || message.type === 'video') {
                  return (
                    <div key={idx} className="rounded-2xl overflow-hidden max-h-72">
                      <video controls className="w-full rounded-2xl">
                        <source src={med.url} />
                      </video>
                    </div>
                  );
                }

                if (med.mimeType?.startsWith('audio/') || message.type === 'voice' || message.type === 'audio') {
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-2xl ${
                        isOwn ? 'bg-white/20' : 'bg-orange-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleAudioToggle(med.url)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition ${
                          isOwn ? 'bg-white text-[#F97316]' : 'bg-[#F97316] text-white'
                        }`}
                      >
                        {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                          <div className={`h-full ${isPlayingAudio ? 'w-2/3 animate-pulse bg-current' : 'w-0'}`} />
                        </div>
                        <div className="flex justify-between text-[10px] mt-1 opacity-80">
                          <span>{message.type === 'voice' ? 'Voice Memo' : 'Audio Note'}</span>
                          <span>{med.duration ? `${Math.round(med.duration)}s` : '0:15'}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Document / File download card
                return (
                  <a
                    key={idx}
                    href={med.url}
                    download
                    className={`flex items-center gap-3 p-2.5 rounded-2xl transition ${
                      isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-orange-50 hover:bg-orange-100 text-[#1F2937]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#F97316] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">Attachment</p>
                      <p className="text-[10px] opacity-75">{med.size ? `${Math.round(med.size / 1024)} KB` : 'Document'}</p>
                    </div>
                    <Download className="w-4 h-4 opacity-80" />
                  </a>
                );
              })}
            </div>
          )}

          {/* Location Card */}
          {message.location && (
            <div className={`p-3 rounded-2xl mb-2 flex items-start gap-2.5 ${isOwn ? 'bg-white/20' : 'bg-orange-50'}`}>
              <MapPin className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">{message.location.label || 'Shared Location'}</p>
                <p className="text-[10px] opacity-80">Lat: {message.location.lat.toFixed(4)}, Lng: {message.location.lng.toFixed(4)}</p>
              </div>
            </div>
          )}

          {/* Contact Card */}
          {message.contact && (
            <div className={`p-3 rounded-2xl mb-2 flex items-center gap-3 ${isOwn ? 'bg-white/20' : 'bg-orange-50'}`}>
              <div className="w-8 h-8 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center font-bold">
                {message.contact.name?.[0] || 'C'}
              </div>
              <div className="text-xs flex-1 min-w-0">
                <p className="font-bold truncate">{message.contact.name}</p>
                <p className="text-[11px] opacity-80 truncate">{message.contact.phone}</p>
              </div>
              <Phone className="w-4 h-4 text-[#F97316]" />
            </div>
          )}

          {/* Message Text Content */}
          {message.text && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">
              {message.text}
            </p>
          )}

          {/* Footer Metadata: Timestamp, Star, Edited, Ticks */}
          <div
            className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none ${
              isOwn ? 'text-white/80' : 'text-[#6B7280]'
            }`}
          >
            {isStarred && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
            {message.editedAt && <span className="text-[9px] italic opacity-75">(edited)</span>}
            <span>{formattedTime}</span>

            {/* Read/Delivered Ticks for sender */}
            {isOwn && (
              <span>
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-200 stroke-[2.5px]" title="Read" />
                ) : isDelivered ? (
                  <CheckCheck className="w-3.5 h-3.5 text-white/90" title="Delivered" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-white/70" title="Sent" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reaction Badges Row */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 ml-1">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact && onReact(message._id, emoji)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#FED7AA] text-xs font-semibold shadow-xs hover:bg-orange-50 transition cursor-pointer"
              >
                <span>{emoji}</span>
                <span className="text-[10px] text-[#6B7280]">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Post Viewer Modal for in-chat inspection */}
        <PostViewerModal
          postId={activeViewerPostId}
          isOpen={Boolean(activeViewerPostId)}
          onClose={() => setActiveViewerPostId(null)}
        />
      </div>
    </div>
  );
});

export default MessageBubble;

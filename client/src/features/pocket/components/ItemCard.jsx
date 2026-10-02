import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Play,
  FileCheck,
  Music,
  Code2,
  MessageSquare,
  Sparkles,
  Lock,
  Pin,
  Star,
  ExternalLink,
  MoreVertical,
  Trash2,
  Folder,
  Eye,
  KeyRound
} from 'lucide-react';
import { usePocketStore } from '../store/usePocketStore';

export const ItemCard = ({
  item,
  onToggleFavorite,
  onTogglePin,
  onDelete,
  onOpenDetail,
  onRequireUnlock
}) => {
  const navigate = useNavigate();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = React.useRef(null);

  const {
    isUnlocked,
    isMultiSelectMode,
    selectedIds,
    toggleSelectItem
  } = usePocketStore();

  const isSelected = selectedIds.includes(item._id);

  // If item is locked and vault is locked, show blurred secure placeholder
  if (item.isLocked && !isUnlocked) {
    return (
      <div
        onClick={() => onRequireUnlock?.(item)}
        className="relative overflow-hidden rounded-3xl bg-white border border-[#FED7AA] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[160px] text-center"
      >
        <div className="absolute inset-0 bg-[#FFF7ED]/70 backdrop-blur-md z-0" />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Lock className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-[#1F2937]">Locked Private Item</span>
          <span className="text-[11px] text-[#6B7280]">Enter Vault PIN to view content</span>
        </div>
      </div>
    );
  }

  // Format file size
  const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAudioPlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (isMultiSelectMode) {
          toggleSelectItem(item._id);
        } else {
          onOpenDetail ? onOpenDetail(item) : navigate(`/pocket/item/${item._id}`);
        }
      }}
      className={`relative group rounded-3xl bg-white border transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between overflow-hidden ${
        isSelected
          ? 'border-[#F97316] ring-2 ring-[#F97316]/30 bg-[#FFF7ED]/30'
          : 'border-[#FED7AA]/80 hover:border-[#F97316]/50'
      }`}
    >
      {/* Top Banner & Header info */}
      <div className="p-4 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Multi-select Checkbox or Type Badge */}
          <div className="flex items-center gap-1.5">
            {isMultiSelectMode ? (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelectItem(item._id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded text-[#F97316] focus:ring-[#F97316] cursor-pointer"
              />
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFF7ED] text-[10px] font-bold text-[#F97316] border border-[#FED7AA]">
                {item.type === 'note' && <FileText className="w-3 h-3" />}
                {item.type === 'link' && <LinkIcon className="w-3 h-3" />}
                {item.type === 'image' && <ImageIcon className="w-3 h-3 text-[#EC4899]" />}
                {item.type === 'video' && <Play className="w-3 h-3 text-purple-600" />}
                {item.type === 'audio' && <Music className="w-3 h-3 text-rose-500" />}
                {item.type === 'document' && <FileCheck className="w-3 h-3 text-amber-600" />}
                {item.type === 'snippet' && <Code2 className="w-3 h-3 text-indigo-500" />}
                {item.type === 'message' && <MessageSquare className="w-3 h-3 text-blue-500" />}
                {item.type === 'post' && <ImageIcon className="w-3 h-3 text-pink-500" />}
                {item.type === 'reel' && <Play className="w-3 h-3 text-pink-500" />}
                {item.type === 'ai_answer' && <Sparkles className="w-3 h-3 text-amber-500" />}
                <span className="capitalize">{item.type.replace('_', ' ')}</span>
              </div>
            )}

            {item.isEncrypted && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-[10px] font-bold text-purple-700 border border-purple-200">
                <KeyRound className="w-3 h-3" />
                <span>E2E</span>
              </span>
            )}

            {item.isPinned && (
              <span className="text-[#F97316]">
                <Pin className="w-3.5 h-3.5 fill-[#F97316]" />
              </span>
            )}
          </div>

          {/* Quick Actions (Favorite, Pin, Trash) */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onToggleFavorite?.(item)}
              aria-label="Toggle Favorite"
              className="p-1 rounded-lg text-[#6B7280] hover:text-amber-500 transition-colors"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  item.isFavorite ? 'fill-amber-400 text-amber-500' : ''
                }`}
              />
            </button>
            <button
              onClick={() => onTogglePin?.(item)}
              aria-label="Toggle Pin"
              className="p-1 rounded-lg text-[#6B7280] hover:text-[#F97316] transition-colors"
            >
              <Pin
                className={`w-3.5 h-3.5 ${
                  item.isPinned ? 'fill-[#F97316] text-[#F97316]' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Title */}
        {item.title && (
          <h3 className="text-xs font-bold text-[#1F2937] line-clamp-1 group-hover:text-[#F97316] transition-colors">
            {item.title}
          </h3>
        )}

        {/* Content by Type */}

        {/* NOTE or SNIPPET */}
        {(item.type === 'note' || item.type === 'snippet') && (
          <p className="text-[11px] text-[#6B7280] line-clamp-3 leading-relaxed font-sans">
            {item.isEncrypted
              ? '🔒 Encrypted content. Click to decrypt in memory with passphrase.'
              : item.content || 'Empty note'}
          </p>
        )}

        {/* LINK with preview */}
        {item.type === 'link' && (
          <div className="space-y-1.5">
            {item.linkPreview?.image ? (
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-[#FFF7ED] border border-[#FED7AA]/50">
                <img
                  src={item.linkPreview.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
              <span className="truncate max-w-[200px]">
                {item.linkPreview?.siteName || (item.url ? new URL(item.url).hostname : '')}
              </span>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#F97316] hover:underline flex items-center gap-0.5 text-[10px] font-bold"
                >
                  <span>Visit</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* IMAGE */}
        {item.type === 'image' && item.media?.[0]?.url && (
          <div className="relative rounded-2xl overflow-hidden aspect-video bg-[#FFF7ED] border border-[#FED7AA]/50">
            <img
              src={item.media[0].url}
              alt={item.title || 'Image attachment'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* VIDEO */}
        {item.type === 'video' && item.media?.[0] && (
          <div className="relative rounded-2xl overflow-hidden aspect-video bg-[#1F2937] flex items-center justify-center">
            {item.media[0].thumbnail ? (
              <img
                src={item.media[0].thumbnail}
                alt="Video thumbnail"
                className="w-full h-full object-cover opacity-70"
              />
            ) : null}
            <div className="absolute w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white">
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </div>
            {item.media[0].duration > 0 && (
              <span className="absolute bottom-2 right-2 text-[10px] font-mono font-bold bg-black/60 px-1.5 py-0.5 rounded text-white">
                {Math.floor(item.media[0].duration / 60)}:{(item.media[0].duration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
        )}

        {/* AUDIO */}
        {item.type === 'audio' && item.media?.[0]?.url && (
          <div className="p-3 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA]/60 flex items-center gap-3">
            <audio
              ref={audioRef}
              src={item.media[0].url}
              onEnded={() => setIsPlayingAudio(false)}
              className="hidden"
            />
            <button
              onClick={handleAudioPlay}
              className="w-8 h-8 rounded-full bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white flex items-center justify-center shadow-sm flex-shrink-0"
            >
              {isPlayingAudio ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#1F2937] truncate">
                {item.title || 'Voice Memo'}
              </p>
              <p className="text-[10px] text-[#6B7280]">
                {item.media[0].duration ? `${item.media[0].duration}s` : formatBytes(item.media[0].size)}
              </p>
            </div>
          </div>
        )}

        {/* DOCUMENT */}
        {item.type === 'document' && (
          <div className="p-3 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA]/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#1F2937] truncate">{item.title}</p>
              <p className="text-[10px] text-[#6B7280]">{formatBytes(item.media?.[0]?.size)}</p>
            </div>
          </div>
        )}

        {/* MESSAGE SNAPSHOT */}
        {item.type === 'message' && (
          <div className="p-3 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA]/60 space-y-1.5">
            <div className="flex items-center gap-2">
              {item.source?.snapshot?.senderAvatar && (
                <img
                  src={item.source.snapshot.senderAvatar}
                  alt="Sender"
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span className="text-[11px] font-bold text-[#1F2937]">
                {item.source?.snapshot?.senderName || 'Chat Message'}
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280] line-clamp-2 italic">
              "{item.content}"
            </p>
            {item.source?.snapshot?.conversationId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/chats/${item.source.snapshot.conversationId}`);
                }}
                className="text-[10px] font-bold text-[#F97316] hover:underline flex items-center gap-1"
              >
                <span>Go to Chat</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}

        {/* SOCIAL POST / REEL SNAPSHOT */}
        {(item.type === 'post' || item.type === 'reel') && (
          <div className="p-3 bg-[#FFF7ED] rounded-2xl border border-[#FED7AA]/60 space-y-1.5">
            <div className="flex items-center gap-2">
              {item.source?.snapshot?.avatar && (
                <img
                  src={item.source.snapshot.avatar}
                  alt="Author"
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span className="text-[11px] font-bold text-[#1F2937]">
                @{item.source?.snapshot?.username || 'Social Post'}
              </span>
            </div>
            {item.content && (
              <p className="text-[11px] text-[#6B7280] line-clamp-2">{item.content}</p>
            )}
            {item.source?.refId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/social/post/${item.source.refId}`);
                }}
                className="text-[10px] font-bold text-[#EC4899] hover:underline flex items-center gap-1"
              >
                <span>Open Original Post</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}

        {/* AI ANSWER */}
        {item.type === 'ai_answer' && (
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-[#FED7AA]/60 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-[#F97316]">
              <Sparkles className="w-3 h-3" />
              <span>Gemini AI Snapshot</span>
            </div>
            <p className="text-[11px] text-[#1F2937] line-clamp-3">{item.content}</p>
          </div>
        )}
      </div>

      {/* Footer Tags & Folder indicator */}
      <div className="px-4 py-2.5 bg-[#FFF7ED]/50 border-t border-[#FED7AA]/40 flex items-center justify-between text-[10px] text-[#6B7280]">
        <div className="flex items-center gap-1 truncate max-w-[180px]">
          {item.folder ? (
            <span className="flex items-center gap-1 font-semibold text-[#1F2937]">
              <Folder className="w-3 h-3 text-[#F97316]" />
              <span className="truncate">{item.folder.name}</span>
            </span>
          ) : (
            <span className="text-[#6B7280]">Unorganized</span>
          )}

          {item.tags?.length > 0 && (
            <span className="text-[#F97316] font-medium ml-1 truncate">
              #{item.tags[0]}
            </span>
          )}
        </div>

        <span className="text-[9px] text-[#6B7280]">
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
          })}
        </span>
      </div>
    </div>
  );
};

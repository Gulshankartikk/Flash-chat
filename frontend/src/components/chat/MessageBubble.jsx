import React, { useState, useRef, useEffect } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Smile,
  Reply,
  MoreHorizontal,
  Forward,
  Trash2,
  Copy,
  FileText,
  Edit2,
  Pin,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import AudioPlayer from "./AudioPlayer";

const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

// Unicode property escapes (requires the `u` regex flag) — correctly matches
// emoji without relying on hand-rolled surrogate-pair ranges that are easy
// to get subtly wrong (the old regex's low-surrogate range started one
// code point too early: \ud000 is a high surrogate, not a low one).
const EMOJI_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;

function isOnlyEmojis(str) {
  if (!str) return false;
  const cleanStr = str.replace(/\s/g, "");
  if (!cleanStr) return false;
  return EMOJI_REGEX.test(cleanStr) && [...cleanStr].length <= 3;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getFileName(url) {
  if (!url) return "Document";
  const parts = url.split("/");
  const lastPart = parts[parts.length - 1];
  try {
    return decodeURIComponent(lastPart);
  } catch {
    return lastPart;
  }
}

// Shared media-attachment renderer for image/gif — was duplicated verbatim
// before aside from alt text; now a single source of truth.
const MediaAttachment = ({ url, alt, onOpen }) => (
  <div className="rounded overflow-hidden mb-2 max-w-xs bg-black/40">
    <img
      src={url}
      alt={alt}
      className="max-h-60 object-cover w-full cursor-zoom-in"
      onClick={onOpen}
    />
  </div>
);

// Simple in-app lightbox for images/GIFs/videos, replacing window.open.
// Closes on backdrop click, the X button, or Escape.
const Lightbox = ({ url, type, onClose }) => {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media preview"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        aria-label="Close preview"
      >
        <X size={22} />
      </button>

      <div onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full">
        {type === "video" ? (
          <video src={url} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg" />
        ) : (
          <img src={url} alt="Full size attachment" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
        )}
      </div>
    </div>
  );
};

const StatusTick = ({ status }) => {
  if (status === "sending") return <Clock size={10} className="text-[#A0A0A0]" />;
  if (status === "failed") return <AlertCircle size={10} className="text-[#FF3D71]" />;
  if (status === "sent") return <Check size={11} className="text-[#A0A0A0]" />;
  if (status === "delivered") return <CheckCheck size={11} className="text-[#A0A0A0]" />;
  if (status === "seen" || status === "read") return <CheckCheck size={11} className="text-[#FFD166]" />;
  return null;
};

const MessageBubble = ({
  msg,
  onRetry,
  onReplyPreviewClick,
  onReply,
  onReact,
  onDelete,
  onForward,
  onEdit,
  onPin,
  currentUserId,
  otherUserName,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [lightboxType, setLightboxType] = useState(null);

  const [decryptedContent, setDecryptedContent] = useState(msg.content || msg.message || "");

  useEffect(() => {
    let active = true;
    const performDecryption = async () => {
      const rawText = msg.content || msg.message || "";
      if (rawText) {
        try {
          const { decryptText } = await import("../../utils/crypto");
          const senderId = msg.sender?._id || msg.sender;
          const convId = msg.conversationId || msg.conversation?._id || msg.conversation;
          const decrypted = await decryptText(rawText, convId, senderId, currentUserId);
          if (active) {
            setDecryptedContent(decrypted);
            setEditText(decrypted);
          }
        } catch (e) {
          if (active) {
            setDecryptedContent(rawText);
            setEditText(rawText);
          }
        }
      } else {
        if (active) {
          setDecryptedContent("");
          setEditText("");
        }
      }
    };
    performDecryption();
    return () => {
      active = false;
    };
  }, [msg.content, msg.message, msg.conversationId, msg.conversation, msg.sender, currentUserId]);

  const pickerRef = useRef(null);
  const menuRef = useRef(null);
  const editTextareaRef = useRef(null);
  const rootRef = useRef(null);

  const isMine = msg.sender?._id === currentUserId || msg.sender === currentUserId || msg.isMine;
  const reactions = msg.reactions || [];

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!contextMenuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setContextMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenuOpen]);

  // Autofocus + select-all when entering edit mode, so the user can start
  // typing immediately instead of having to click into the textarea first.
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.select();
    }
  }, [isEditing]);

  const handlePickReaction = (emoji) => {
    setPickerOpen(false);
    if (onReact) onReact(msg, emoji);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(decryptedContent);
    toast.success("Copied to clipboard");
    setContextMenuOpen(false);
  };

  const handleEditSubmit = () => {
    if (!editText.trim()) return;
    if (onEdit) {
      onEdit(msg, editText.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsEditing(false);
    } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleEditSubmit();
    }
  };

  // Group reactions by emoji, tracking whether the current user is among
  // the reactors (drives the "mine" highlight state).
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.user?._id === currentUserId || r.user === currentUserId || r.userId === currentUserId) {
      acc[r.emoji].mine = true;
    }
    return acc;
  }, {});
  const reactionList = Object.values(groupedReactions);

  const isImage = msg.contentType === "image" || msg.messageType === "image" || (msg.imageOrVideoUrl && !msg.contentType && !msg.imageOrVideoUrl.endsWith(".gif"));
  const isVideo = msg.contentType === "video" || msg.messageType === "video";
  const isAudio = msg.contentType === "audio" || msg.messageType === "audio";
  const isDocument = msg.contentType === "document" || msg.messageType === "document";
  const isGif = msg.contentType === "gif" || msg.messageType === "gif" || (msg.imageOrVideoUrl && msg.imageOrVideoUrl.endsWith(".gif"));

  const isPureEmoji = isOnlyEmojis(decryptedContent) && !isImage && !isVideo && !isAudio && !isDocument && !isGif;

  const isDeleted = msg.isDeletedForEveryone || msg.isDeleted;

  const openLightbox = (url, type) => {
    setLightboxUrl(url);
    setLightboxType(type);
  };

  // Reply preview shows the actual other participant's name instead of a
  // hardcoded "Contact" placeholder.
  const replySenderLabel = (() => {
    if (!msg.replyTo) return "";
    const replySenderId = msg.replyTo.sender?._id || msg.replyTo.sender;
    return String(replySenderId) === String(currentUserId) ? "You" : (otherUserName || "Contact");
  })();

  return (
    <div
      ref={rootRef}
      className="flex w-full mb-2 px-4 relative"
      style={{ justifyContent: isMine ? "flex-end" : "flex-start" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e) => {
        // Only collapse hover/picker/menu once the pointer has actually left
        // the whole bubble+controls group (rootRef), not just the inner div
        // that triggered mouseenter. relatedTarget is the element the mouse
        // is moving INTO; if it's still inside rootRef (e.g. the emoji
        // picker or context menu, which are positioned absolutely but
        // nested inside rootRef), we don't close anything.
        if (rootRef.current && e.relatedTarget instanceof Node && rootRef.current.contains(e.relatedTarget)) {
          return;
        }
        setHovered(false);
        setPickerOpen(false);
        setContextMenuOpen(false);
      }}
    >
      <div
        className={`flex items-center gap-2 relative ${isMine ? "flex-row-reverse" : "flex-row"}`}
        style={{ maxWidth: "75%" }}
      >
        {/* Bubble container */}
        <div
          id={`msg-${msg._id}`}
          className={`relative rounded-2xl px-4 py-2.5 transition-all duration-150 ${
            isPureEmoji
              ? "bg-transparent shadow-none"
              : isMine
              ? "bg-[#FF6B00] text-[#FFFFFF] rounded-tr-none shadow-md"
              : "bg-slate-100 dark:bg-[#1c1c1c] text-slate-800 dark:text-[#FFFFFF] rounded-tl-none shadow-md"
          }`}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenuOpen(true);
          }}
        >
          {/* Pinned Indicator badge */}
          {msg.isPinned && (
            <div className="flex items-center gap-1 text-[10px] text-[#FFD166] mb-1 font-semibold">
              <Pin size={10} className="rotate-45" /> Pinned
            </div>
          )}

          {isDeleted ? (
            <p className="text-xs italic text-[#555555] flex items-center gap-2">
              🚫 This message was deleted
            </p>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                ref={editTextareaRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={2}
                aria-label="Edit message"
                className="w-full p-2 bg-slate-50 dark:bg-black text-slate-800 dark:text-[#FFFFFF] border border-slate-200 dark:border-[#222222] focus:border-[#FF6B00] rounded-xl text-xs outline-none resize-none"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 text-[10px] bg-slate-700 rounded-lg text-white hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  disabled={!editText.trim()}
                  className="px-2.5 py-1 text-[10px] bg-[#FF6B00] rounded-lg text-white hover:bg-[#E05E00] disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {msg.replyTo && (
                <div
                  onClick={() => onReplyPreviewClick && onReplyPreviewClick(msg.replyTo)}
                  className="border-l-2 border-[#FFD166] bg-black/25 rounded p-2 mb-2 text-left cursor-pointer"
                >
                  <p className="text-xs font-semibold text-[#FFD166]">{replySenderLabel}</p>
                  <p className="text-xs text-[#A0A0A0] truncate">
                    {msg.replyTo.content || msg.replyTo.message || "Media"}
                  </p>
                </div>
              )}

              {isImage && msg.imageOrVideoUrl && (
                <MediaAttachment
                  url={msg.imageOrVideoUrl}
                  alt="Attachment"
                  onOpen={() => openLightbox(msg.imageOrVideoUrl, "image")}
                />
              )}

              {isGif && msg.imageOrVideoUrl && (
                <MediaAttachment
                  url={msg.imageOrVideoUrl}
                  alt="GIF Attachment"
                  onOpen={() => openLightbox(msg.imageOrVideoUrl, "image")}
                />
              )}

              {isVideo && msg.imageOrVideoUrl && (
                <div
                  className="rounded overflow-hidden mb-2 max-w-xs bg-black/40 cursor-zoom-in"
                  onClick={() => openLightbox(msg.imageOrVideoUrl, "video")}
                >
                  <video src={msg.imageOrVideoUrl} className="max-h-60 w-full pointer-events-none" />
                </div>
              )}

              {isAudio && msg.imageOrVideoUrl && (
                <div className="mb-2">
                  <AudioPlayer src={msg.imageOrVideoUrl} isMine={isMine} />
                </div>
              )}

              {isDocument && msg.imageOrVideoUrl && (
                <div className="rounded p-3 mb-2 max-w-xs bg-slate-50/50 dark:bg-black/40 border border-slate-200 dark:border-[#222222] flex items-center gap-3">
                  <div className="p-2.5 bg-[#FF6B00]/15 text-[#FF6B00] rounded-xl flex-shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                      {msg.content || getFileName(msg.imageOrVideoUrl)}
                    </p>
                    <a
                      href={msg.imageOrVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#00E676] hover:underline block mt-0.5"
                    >
                      Download File
                    </a>
                  </div>
                </div>
              )}

              {decryptedContent && !isPureEmoji ? (
                <p className="text-[14.5px] leading-relaxed break-words text-left">
                  {decryptedContent}
                </p>
              ) : isPureEmoji ? (
                <p className="text-4xl leading-relaxed break-words text-center py-1">
                  {decryptedContent}
                </p>
              ) : null}

              {/* Status and timestamp */}
              <div className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] text-[#A0A0A0]/80 ${isPureEmoji ? "absolute bottom-1 right-2 bg-black/60 rounded px-1" : ""}`}>
                <span>{formatTime(msg.createdAt)}</span>
                {msg.isEdited && <span className="text-[9px] italic">(edited)</span>}
                {msg.content?.startsWith("e2ee:") && <span className="text-[10px]" title="End-to-End Encrypted">🔒</span>}
                {isMine && <StatusTick status={msg.messageStatus || msg.status} />}
              </div>
            </>
          )}

          {/* Reactions Overlay */}
          {reactionList.length > 0 && !isEditing && (
            <div className="absolute -bottom-2.5 right-2 flex gap-1 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-full px-1.5 py-0.5 shadow-lg">
              {reactionList.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => handlePickReaction(r.emoji)}
                  aria-label={`React with ${r.emoji}${r.mine ? " (tap to remove your reaction)" : ""}`}
                  className={`text-xs hover:scale-125 transition-transform ${r.mine ? "opacity-100" : "opacity-80"}`}
                >
                  {r.emoji} <span className="text-[9px] font-bold">{r.count > 1 ? r.count : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover Controls */}
        {hovered && !isDeleted && !isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPickerOpen(true)}
              aria-label="Add reaction"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#FFFFFF] transition-colors"
              title="Add reaction"
            >
              <Smile size={14} />
            </button>
            <button
              onClick={() => onReply && onReply(msg)}
              aria-label="Reply"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#FFFFFF] transition-colors"
              title="Reply"
            >
              <Reply size={14} />
            </button>
            <button
              onClick={() => setContextMenuOpen(true)}
              aria-label="More options"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#FFFFFF] transition-colors"
              title="More"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        )}

        {/* EMOJI PICKER TOOLTIP */}
        {pickerOpen && (
          <div
            ref={pickerRef}
            role="menu"
            aria-label="Quick reactions"
            className="absolute bottom-full mb-2 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-full py-1 px-3 flex gap-2.5 shadow-xl z-20"
            style={{ [isMine ? "right" : "left"]: 0 }}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handlePickReaction(emoji)}
                aria-label={`React with ${emoji}`}
                className="text-lg hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* CONTEXT MENU */}
        {contextMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Message options"
            className="absolute bottom-full mb-2 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-lg py-1 flex flex-col shadow-2xl w-36 z-30 text-left"
            style={{ [isMine ? "right" : "left"]: 0 }}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-800 dark:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
            >
              <Copy size={12} /> Copy Message
            </button>
            <button
              onClick={() => {
                if (onForward) onForward(msg);
                setContextMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-800 dark:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
            >
              <Forward size={12} /> Forward
            </button>
            {isMine && !isDocument && !isImage && !isVideo && !isAudio && !isGif && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditText(decryptedContent);
                  setContextMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-800 dark:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
              >
                <Edit2 size={12} /> Edit Message
              </button>
            )}
            <button
              onClick={() => {
                if (onPin) onPin(msg);
                setContextMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-800 dark:text-[#FFFFFF] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
            >
              <Pin size={12} className="rotate-45" /> {msg.isPinned ? "Unpin Message" : "Pin Message"}
            </button>
            <button
              onClick={() => {
                if (onDelete) onDelete(msg, "me");
                setContextMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs text-[#FF9E00] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
            >
              <Trash2 size={12} /> Delete for Me
            </button>
            {isMine && (
              <button
                onClick={() => {
                  if (onDelete) onDelete(msg, "everyone");
                  setContextMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-[#FF3D71] hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors w-full"
              >
                <Trash2 size={12} /> Delete for All
              </button>
            )}
          </div>
        )}
      </div>

      {lightboxUrl && (
        <Lightbox
          url={lightboxUrl}
          type={lightboxType}
          onClose={() => {
            setLightboxUrl(null);
            setLightboxType(null);
          }}
        />
      )}
    </div>
  );
};

export default MessageBubble;
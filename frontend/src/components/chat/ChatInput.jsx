import React, { useState, useRef, useEffect, useCallback } from "react";
import { Paperclip, Smile, Send, X, File, Video, Mic } from "lucide-react";
import ReplyPreview from "./ReplyPreview";
import VoiceRecorder from "./VoiceRecorder";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_MESSAGE_LENGTH = 4000; // adjust to match your backend's content limit

// Small curated set so this stays dependency-free. Swap for a library like
// emoji-picker-react if you want search/categories/skin-tone variants later.
const EMOJI_OPTIONS = [
  "😀", "😂", "😍", "😊", "😢", "😡", "👍", "👎",
  "🙏", "🎉", "❤️", "🔥", "😮", "🤔", "😴", "👏",
  "🙌", "💀", "😎", "🥳", "😅", "🤝", "✅", "❌",
];

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ChatInput = ({
  onSend,
  replyTo,
  onCancelReply,
  otherUserId,
  otherUserName,
  onTypingStart,
  onTypingStop,
}) => {
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileType, setFileType] = useState("text"); // "text" | "image" | "video" | "audio" | "document"
  const [fileError, setFileError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

  const handleSendVoice = (audioFile, duration) => {
    setIsRecordingVoice(false);
    if (onSend) {
      onSend({
        message: "",
        messageType: "audio",
        mediaFile: audioFile,
      });
    }
  };

  // Stop the "typing..." indicator from getting stuck if the component
  // unmounts (e.g. user navigates away) while a timeout is still pending.
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onTypingStop) onTypingStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke the object URL whenever it changes or the component unmounts,
  // not just when explicitly cancelled — covers the "picked a different
  // file before sending/cancelling" case the old code missed.
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  // Close the emoji picker on outside click.
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !emojiButtonRef.current?.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const handleTextChange = (e) => {
    setDraft(e.target.value);

    if (onTypingStart) onTypingStart();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File is too large. Max size is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
      e.target.value = ""; // allow re-selecting the same file after dismissing
      return;
    }

    // Revoking happens automatically via the filePreview useEffect cleanup
    // above when filePreview changes below, so no manual revoke needed here.
    setSelectedFile(file);
    const mime = file.type;

    if (mime.startsWith("image/")) {
      setFileType("image");
      setFilePreview(URL.createObjectURL(file));
    } else if (mime.startsWith("video/")) {
      setFileType("video");
      setFilePreview(URL.createObjectURL(file));
    } else if (mime.startsWith("audio/")) {
      setFileType("audio");
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFileType("document");
      setFilePreview(null);
    }

    // Reset the input value so selecting the same file again later still
    // fires onChange (browsers won't fire it if the value is unchanged).
    e.target.value = "";
  };

  const handleCancelFile = useCallback(() => {
    // filePreview revocation is handled by the useEffect cleanup; just clear state.
    setSelectedFile(null);
    setFilePreview(null);
    setFileType("text");
    setFileError(null);
  }, []);

  const handleSendClick = () => {
    const trimmed = draft.trim();
    if (!trimmed && !selectedFile) return;

    if (selectedFile) {
      onSend({
        message: trimmed,
        messageType: fileType,
        mediaFile: selectedFile,
      });
      handleCancelFile();
    } else {
      onSend({
        message: trimmed,
        messageType: "text",
      });
    }

    setDraft("");
    setShowEmojiPicker(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (onTypingStop) onTypingStop();
  };

  const handleKeyDown = (e) => {
    // isComposing / keyCode 229 guards against IME composition (Japanese,
    // Chinese, Korean, etc.) where Enter confirms a candidate rather than
    // submitting the message.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setDraft((prev) => prev + emoji);
    textInputRef.current?.focus();
  };

  const isOverLimit = draft.length > MAX_MESSAGE_LENGTH;

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-[#111111] border-t border-slate-200 dark:border-[#222222] z-10 flex-shrink-0">
      {/* Reply Preview */}
      {replyTo && (
        <ReplyPreview
          replyTo={replyTo}
          onCancel={onCancelReply}
          otherUserName={otherUserName}
        />
      )}

      {/* File Error Banner */}
      {fileError && (
        <div className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-[#2a1414] border-t border-red-200 dark:border-[#3a1f1f] text-xs text-red-600 dark:text-[#FF6B6B]">
          <span>{fileError}</span>
          <button
            onClick={() => setFileError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-[#3a1f1f] rounded-full"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* File Preview Bar */}
      {selectedFile && (
        <div className="flex items-center justify-between p-3 bg-white dark:bg-[#1c1c1c] border-t border-slate-200 dark:border-[#222222]">
          <div className="flex items-center gap-3">
            {fileType === "image" && (
              <img src={filePreview} alt="preview" className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-[#222222]" />
            )}
            {fileType === "video" && (
              <div className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-black rounded-lg border border-slate-200 dark:border-[#222222]">
                <Video size={18} className="text-[#FFD166]" />
              </div>
            )}
            {fileType === "audio" && (
              <div className="w-12 h-12 flex items-center justify-center bg-slate-200 dark:bg-[#222222] rounded-lg">
                <span className="text-xl">🎵</span>
              </div>
            )}
            {fileType === "document" && (
              <div className="w-12 h-12 flex items-center justify-center bg-slate-200 dark:bg-[#222222] rounded-lg">
                <File size={20} className="text-[#FF6B00]" />
              </div>
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-800 dark:text-[#FFFFFF] truncate max-w-[200px]">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-[#A0A0A0]">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelFile}
            className="p-1 hover:bg-slate-200 dark:hover:bg-[#222222] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF3D71]"
            aria-label="Remove attached file"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Voice Recorder or Main Input Row */}
      {isRecordingVoice ? (
        <div className="p-3">
          <VoiceRecorder
            onSendVoice={handleSendVoice}
            onCancel={() => setIsRecordingVoice(false)}
          />
        </div>
      ) : (
        <div className="relative flex items-center gap-3 p-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-slate-200 dark:hover:bg-[#1c1c1c] rounded-full text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF6B00] transition-colors"
            title="Attach File"
            aria-label="Attach file"
          >
            <Paperclip size={20} />
          </button>

          <button
            ref={emojiButtonRef}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2 hover:bg-slate-200 dark:hover:bg-[#1c1c1c] rounded-full transition-colors ${
              showEmojiPicker
                ? "text-[#FF9E00] bg-slate-200 dark:bg-[#1c1c1c]"
                : "text-slate-400 dark:text-[#A0A0A0] hover:text-[#FF9E00]"
            }`}
            title="Emojis"
            aria-label="Open emoji picker"
            aria-expanded={showEmojiPicker}
          >
            <Smile size={20} />
          </button>

          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              role="dialog"
              aria-label="Emoji picker"
              className="absolute bottom-full left-3 mb-2 grid grid-cols-8 gap-1 p-2 bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#222222] rounded-xl shadow-lg z-20"
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 flex flex-col">
            <input
              ref={textInputRef}
              type="text"
              value={draft}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
              aria-label="Message"
              maxLength={MAX_MESSAGE_LENGTH + 100} // small buffer; isOverLimit drives the real block
              className={`px-4 py-2.5 rounded-full bg-white dark:bg-[#1c1c1c] text-slate-800 dark:text-[#FFFFFF] placeholder-slate-400 dark:placeholder-[#555555] border text-sm transition-colors focus:outline-none ${
                isOverLimit
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-200 dark:border-[#222222] focus:border-[#FF6B00]"
              }`}
            />
            {isOverLimit && (
              <span className="text-[10px] text-red-500 mt-1 ml-2">
                {draft.length}/{MAX_MESSAGE_LENGTH} — message is too long
              </span>
            )}
          </div>

          {draft.trim() || selectedFile ? (
            <button
              onClick={handleSendClick}
              disabled={isOverLimit}
              aria-label="Send message"
              className="p-2.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-full transition-colors flex-shrink-0 shadow-md shadow-[#FF6B00]/20"
            >
              <Send size={16} />
            </button>
          ) : (
            <button
              onClick={() => setIsRecordingVoice(true)}
              aria-label="Record voice message"
              title="Record voice message"
              className="p-2.5 bg-[#FF6B00]/10 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white rounded-full transition-all flex-shrink-0"
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatInput;
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X, Image as ImageIcon } from 'lucide-react';
import { getSocket } from '../../services/socket';

const POPULAR_EMOJIS = ['😀', '😂', '🔥', '❤️', '👍', '🎉', '⚡', '✨', '🚀', '😎', '🙏', '💯', '👏', '😍', '🥳'];

export const MessageInput = ({ chatId, onSendMessage }) => {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const socket = getSocket();

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Throttled typing indicator emit
  const handleContentChange = (e) => {
    setContent(e.target.value);

    if (socket && chatId) {
      socket.emit('typing:start', { chatId });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { chatId });
      }, 2000);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('Selected file exceeds maximum limit of 10MB.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!content.trim() && !selectedFile) return;

    if (socket && chatId) {
      socket.emit('typing:stop', { chatId });
    }

    const payload = {
      content: content.trim(),
      file: selectedFile
    };

    setContent('');
    clearSelectedFile();
    setShowEmojiPicker(false);

    try {
      await onSendMessage(payload);
    } catch (err) {
      console.error('Failed to dispatch message:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="relative border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 md:p-4">
      {/* File attachment preview */}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 max-w-sm">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              className="w-12 h-12 object-cover rounded-lg"
            />
          ) : (
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg flex items-center justify-center text-indigo-600">
              <Paperclip className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {selectedFile.name}
            </p>
            <p className="text-[11px] text-slate-400">
              {Math.round(selectedFile.size / 1024)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={clearSelectedFile}
            className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 z-30 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 grid grid-cols-5 gap-1 animate-in fade-in zoom-in-95 duration-100">
          {POPULAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="w-9 h-9 text-lg flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input controls */}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,audio/*,.pdf,.zip,.txt"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex-shrink-0"
          title="Attach file or photo"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex-shrink-0"
          title="Insert emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <textarea
            rows="1"
            placeholder="Type a message... (Press Enter to send)"
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 max-h-32"
          />
        </div>

        <button
          type="submit"
          disabled={!content.trim() && !selectedFile}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-indigo-500/25 disabled:opacity-40 disabled:hover:bg-indigo-600 transition flex-shrink-0"
          title="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

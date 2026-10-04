import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Image, X, Sparkles, AlertCircle } from 'lucide-react';

export const AiComposer = ({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask Flash AI anything... (Shift+Enter for new line)',
  maxChars = 8000,
  initialText = ''
}) => {
  const [text, setText] = useState(initialText);
  const [attachments, setAttachments] = useState([]); // [{ url, base64, mimeType, name }]
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (isStreaming) {
      if (onStop) onStop();
      return;
    }
    if ((!text.trim() && attachments.length === 0) || disabled) return;

    if (onSend) {
      onSend({
        message: text.trim(),
        attachments
      });
    }

    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Process & compress uploaded image using HTML5 Canvas
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = 4 - attachments.length;
    const selectedFiles = files.slice(0, remainingSlots);

    selectedFiles.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('Image exceeds 5MB limit.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL(file.type || 'image/jpeg', 0.85);
          const rawBase64 = compressedBase64.split(',')[1];

          setAttachments((prev) => [
            ...prev,
            {
              url: compressedBase64,
              base64: rawBase64,
              mimeType: file.type || 'image/jpeg',
              name: file.name
            }
          ]);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const isNearLimit = text.length > maxChars * 0.85;

  return (
    <div className="p-3 sm:p-4 bg-card dark:bg-zinc-900 border-t border-line dark:border-zinc-800 shrink-0">
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 mb-2.5 overflow-x-auto pb-1">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-line dark:border-zinc-700 bg-cream">
              <img src={att.url} alt={att.name || 'Attachment'} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2 bg-cream dark:bg-zinc-800 rounded-2xl border border-line dark:border-zinc-700 p-2 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          multiple
          className="hidden"
        />

        {/* Attach Image Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= 4 || isStreaming || disabled}
          className="p-2 text-muted hover:text-primary dark:hover:text-pink-400 rounded-xl hover:bg-orange-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
          title="Attach image (up to 4, max 5MB)"
          aria-label="Attach images"
        >
          <Image className="w-5 h-5" />
        </button>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled && !isStreaming}
          rows={1}
          className="flex-1 max-h-44 bg-transparent resize-none text-xs sm:text-sm text-ink dark:text-cream placeholder-muted focus:outline-none py-1.5 leading-relaxed"
        />

        {/* Char count if near limit */}
        {isNearLimit && (
          <span className="text-[10px] text-muted self-center pr-1 select-none font-mono">
            {text.length}/{maxChars}
          </span>
        )}

        {/* Send / Stop Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={(!text.trim() && attachments.length === 0 && !isStreaming) || (disabled && !isStreaming)}
          className={`p-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
            isStreaming
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
              : 'bg-gradient-to-r from-primary to-secondary text-white shadow-primary/25 hover:brightness-105'
          }`}
          title={isStreaming ? 'Stop generating' : 'Send prompt (Enter)'}
          aria-label={isStreaming ? 'Stop generating' : 'Send prompt'}
        >
          {isStreaming ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

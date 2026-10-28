import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  MicOff,
  Image,
  Video,
  FileText,
  MapPin,
  X,
  StopCircle,
  Sparkles,
  Phone,
  RefreshCw,
  Wand2,
  Undo
} from 'lucide-react';
import api from '../../services/api';
import { fetchSmartReplies, rewriteChatMessage, AiBadge, AiThinking } from '../../features/ai';
import { FlashAiLogo } from '../common/FlashAiLogo';

const EMOJI_LIST = [
  '😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '❤️',
  '🚀', '✨', '⚡', '😎', '🥳', '💯', '🤔', '👋',
  '😭', '👏', '🙌', '👀', '💡', '🌟', '🌹', '🍕'
];

export const MessageInput = ({
  conversationId,
  allowAi = true,
  onSend,
  onTypingStart,
  onTypingStop,
  replyingTo,
  onCancelReply,
  disabled = false
}) => {
  const [text, setText] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // AI states
  const [smartReplies, setSmartReplies] = useState([]);
  const [showSmartReplies, setShowSmartReplies] = useState(true);
  const [isFetchingReplies, setIsFetchingReplies] = useState(false);
  const [showRewriteMenu, setShowRewriteMenu] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [undoText, setUndoText] = useState(null);
  const [showAiAutocomplete, setShowAiAutocomplete] = useState(false);

  // Load smart replies when conversation opens
  useEffect(() => {
    let mounted = true;
    if (!conversationId || !allowAi) {
      setSmartReplies([]);
      return;
    }

    const loadReplies = async () => {
      try {
        setIsFetchingReplies(true);
        const replies = await fetchSmartReplies({ conversationId, lastN: 8 });
        if (mounted && Array.isArray(replies) && replies.length > 0) {
          setSmartReplies(replies);
          setShowSmartReplies(true);
        }
      } catch (_) {
      } finally {
        if (mounted) setIsFetchingReplies(false);
      }
    };

    const timer = setTimeout(loadReplies, 600);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [conversationId, allowAi]);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Manage voice note recording duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (allowAi && (val.endsWith('@') || val.endsWith('@ai') || val.endsWith('@AI'))) {
      setShowAiAutocomplete(true);
    } else {
      setShowAiAutocomplete(false);
    }

    // Trigger typing event
    if (onTypingStart) onTypingStart();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 1500);
  };

  const handleSelectAiMention = () => {
    setText((prev) => prev.replace(/@ai?$/i, '@ai '));
    setShowAiAutocomplete(false);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (onTypingStop) onTypingStop();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    onSend({
      text: trimmed,
      type: 'text',
      replyTo: replyingTo
    });

    setText('');
    if (onCancelReply) onCancelReply();
    setShowEmojiPicker(false);
    setShowAttachments(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File Attachment Upload Handler
  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachments(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Upload file via REST API
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const mediaUrl = res.data?.url || res.data?.file?.url;
      if (mediaUrl) {
        onSend({
          text: '',
          type,
          media: [
            {
              url: mediaUrl,
              publicId: res.data?.publicId,
              mimeType: file.type,
              size: file.size
            }
          ],
          replyTo: replyingTo
        });
      }
    } catch (err) {
      console.warn('Media upload warning, sending local preview:', err.message);
      // Fallback local URL in case upload server is in offline dev mode
      const localUrl = URL.createObjectURL(file);
      onSend({
        text: '',
        type,
        media: [
          {
            url: localUrl,
            mimeType: file.type,
            size: file.size
          }
        ],
        replyTo: replyingTo
      });
    } finally {
      if (onCancelReply) onCancelReply();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Location Sharing Handler
  const handleShareLocation = () => {
    setShowAttachments(false);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSend({
            text: '📍 Shared current location',
            type: 'location',
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              label: 'My Current Location'
            },
            replyTo: replyingTo
          });
          if (onCancelReply) onCancelReply();
        },
        (err) => {
          alert('Unable to retrieve location. Please grant permission in browser.');
        }
      );
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        if (recordingDuration < 1) return; // Discard accidental clicks

        const audioUrl = URL.createObjectURL(audioBlob);
        onSend({
          text: '',
          type: 'voice',
          media: [
            {
              url: audioUrl,
              mimeType: 'audio/webm',
              duration: recordingDuration
            }
          ],
          replyTo: replyingTo
        });

        if (onCancelReply) onCancelReply();
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) {
        audioChunksRef.current = [];
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="relative border-t border-line bg-card p-3 sm:p-4">
      {/* Active Quoted Reply Bar */}
      {replyingTo && (
        <div className="mb-2 p-2.5 rounded-2xl bg-cream border border-line flex items-center justify-between text-xs animate-fadeIn">
          <div className="border-l-4 border-primary pl-2.5 min-w-0">
            <span className="font-bold text-primary block">
              Replying to {replyingTo.sender?.name || 'User'}
            </span>
            <p className="truncate text-muted text-[11px] mt-0.5">
              {replyingTo.text || 'Attachment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full text-muted hover:text-ink hover:bg-cream transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachments && (
        <div className="absolute bottom-20 left-4 z-30 p-3 rounded-2xl bg-card border border-line shadow-xl grid grid-cols-4 gap-3 text-center text-xs animate-scaleUp">
          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-cream cursor-pointer text-ink transition">
            <div className="w-10 h-10 rounded-full bg-cream border border-line text-primary flex items-center justify-center shadow-xs">
              <Image className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'image')}
              className="hidden"
            />
          </label>

          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-cream cursor-pointer text-ink transition">
            <div className="w-10 h-10 rounded-full bg-cream border border-line text-secondary flex items-center justify-center shadow-xs">
              <Video className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">Video</span>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => handleFileUpload(e, 'video')}
              className="hidden"
            />
          </label>

          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-cream cursor-pointer text-ink transition">
            <div className="w-10 h-10 rounded-full bg-cream border border-line text-primary flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">Document</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.zip,.txt"
              onChange={(e) => handleFileUpload(e, 'document')}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleShareLocation}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-cream cursor-pointer text-ink transition"
          >
            <div className="w-10 h-10 rounded-full bg-cream text-primary border border-line flex items-center justify-center shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">Location</span>
          </button>
        </div>
      )}

      {/* Smart Reply Chips Bar */}
      {allowAi && showSmartReplies && smartReplies.length > 0 && !text && (
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 animate-fadeIn">
          <div className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            <Sparkles className="w-3 h-3" />
            <span>AI:</span>
          </div>
          {smartReplies.map((reply, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setText(reply)}
              className="shrink-0 px-3 py-1 rounded-full bg-cream hover:bg-cream/80 border border-line text-xs text-ink hover:text-primary transition shadow-xs cursor-pointer font-medium"
            >
              {reply}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowSmartReplies(false)}
            className="p-1 rounded-full text-muted hover:text-ink cursor-pointer"
            title="Dismiss suggestions"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* @ai Autocomplete Suggestion Chip */}
      {allowAi && (text === '@' || text.toLowerCase() === '@a' || text.toLowerCase() === '@ai') && (
        <div className="mb-2 flex items-center gap-2 animate-fadeIn">
          <button
            type="button"
            onClick={() => setText('@ai ')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-brand-gradient text-white text-xs font-bold shadow-md shadow-primary/20 hover:brightness-105 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Flash AI (@ai)</span>
          </button>
          <span className="text-[11px] text-muted">Type your question after @ai</span>
        </div>
      )}

      {/* Undo Rewrite Notification */}
      {undoText && (
        <div className="mb-2 flex items-center justify-between p-2 rounded-xl bg-cream border border-line text-xs text-ink">
          <span>✨ Message rewritten by Flash AI</span>
          <button
            type="button"
            onClick={() => {
              setText(undoText);
              setUndoText(null);
            }}
            className="flex items-center gap-1 font-bold text-primary hover:underline cursor-pointer"
          >
            <Undo className="w-3 h-3" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Rewrite Tone Dropdown Popup */}
      {showRewriteMenu && (
        <div className="absolute bottom-20 right-16 z-30 p-2 rounded-2xl bg-card border border-line shadow-xl text-xs space-y-1 w-36 animate-scaleUp">
          <p className="px-2 py-1 text-[10px] font-bold text-muted uppercase tracking-wider">Rewrite tone</p>
          {['friendly', 'formal', 'short'].map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={async () => {
                setShowRewriteMenu(false);
                if (!text.trim()) return;
                try {
                  setIsRewriting(true);
                  const res = await rewriteChatMessage({ text: text.trim(), tone });
                  setUndoText(text);
                  setText(res?.rewritten || res);
                } catch (e) {
                  console.error(e);
                } finally {
                  setIsRewriting(false);
                }
              }}
              className="w-full text-left px-2 py-1.5 rounded-xl hover:bg-cream text-ink capitalize font-medium transition cursor-pointer"
            >
              {tone}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 z-30 p-3 rounded-2xl bg-card border border-line shadow-xl max-w-xs grid grid-cols-6 gap-2 text-xl animate-scaleUp">
          {EMOJI_LIST.map((em, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setText((prev) => prev + em)}
              className="p-1 hover:scale-125 transition transform cursor-pointer"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Input Row */}
      {isRecording ? (
        /* Voice Note Recording Overlay */
        <div className="flex items-center justify-between p-2 rounded-2xl bg-accent/10 border border-accent/30 text-accent animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-accent animate-ping" />
            <span className="text-xs font-bold">Recording Voice Note...</span>
            <span className="text-xs font-mono font-bold bg-card px-2 py-0.5 rounded-md border border-line text-ink">
              {formatTimer(recordingDuration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="p-2 text-muted hover:text-accent hover:bg-cream rounded-full transition cursor-pointer"
              title="Cancel recording"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="px-3.5 py-1.5 rounded-xl bg-brand-gradient text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      ) : (
        /* Standard Message Bar */
        <div className="flex items-center gap-2">
          {/* Attachment Toggle */}
          <button
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            className="p-2.5 rounded-full text-muted hover:text-primary hover:bg-cream transition cursor-pointer"
            title="Attach file or media"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 rounded-full text-muted hover:text-primary hover:bg-cream transition cursor-pointer"
            title="Emoji picker"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Message Text Input */}
          <div className="flex-1 relative">
            {showAiAutocomplete && (
              <div className="absolute bottom-full left-0 mb-2 p-1.5 bg-card border border-line rounded-2xl shadow-xl z-30 min-w-56 animate-in fade-in slide-in-from-bottom-2">
                <button
                  type="button"
                  onClick={handleSelectAiMention}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-cream text-xs font-bold text-ink w-full text-left transition cursor-pointer"
                >
                  <FlashAiLogo size="sm" showText={false} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-primary font-bold">@ai</span>
                      <span>Flash AI</span>
                    </div>
                    <p className="text-[10px] text-muted font-normal">Ask questions or generate assistance</p>
                  </div>
                </button>
              </div>
            )}

            <input
              type="text"
              disabled={disabled}
              placeholder="Type a message or use @ai to ask Flash AI..."
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              className="w-full py-2.5 pl-4 pr-10 rounded-2xl border border-line bg-cream/40 text-ink text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-card transition"
            />
            {allowAi && text.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setShowRewriteMenu(!showRewriteMenu)}
                disabled={isRewriting}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:text-secondary rounded-full hover:bg-cream/50 transition cursor-pointer"
                title="Rewrite with Flash AI (Formal, Friendly, Short)"
              >
                <Sparkles className={`w-4 h-4 ${isRewriting ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Send or Voice Record Button */}
          {text.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled}
              className="p-2.5 rounded-2xl bg-brand-gradient hover:opacity-95 text-white shadow-md shadow-primary/25 transition cursor-pointer flex-shrink-0"
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className="p-2.5 rounded-2xl bg-cream hover:bg-cream/80 text-primary border border-line transition cursor-pointer flex-shrink-0"
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageInput;

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
  Phone
} from 'lucide-react';
import api from '../../services/api';

const EMOJI_LIST = [
  '😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '❤️',
  '🚀', '✨', '⚡', '😎', '🥳', '💯', '🤔', '👋',
  '😭', '👏', '🙌', '👀', '💡', '🌟', '🌹', '🍕'
];

export const MessageInput = ({
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
    setText(e.target.value);

    // Trigger typing event
    if (onTypingStart) onTypingStart();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 1500);
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
    <div className="relative border-t border-[#FED7AA] bg-white p-3 sm:p-4">
      {/* Active Quoted Reply Bar */}
      {replyingTo && (
        <div className="mb-2 p-2.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-between text-xs animate-fadeIn">
          <div className="border-l-4 border-[#F97316] pl-2.5 min-w-0">
            <span className="font-bold text-[#F97316] block">
              Replying to {replyingTo.sender?.name || 'User'}
            </span>
            <p className="truncate text-[#6B7280] text-[11px] mt-0.5">
              {replyingTo.text || 'Attachment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full text-[#6B7280] hover:text-[#1F2937] hover:bg-orange-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachments && (
        <div className="absolute bottom-20 left-4 z-30 p-3 rounded-2xl bg-white border border-[#FED7AA] shadow-xl grid grid-cols-4 gap-3 text-center text-xs animate-scaleUp">
          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#FFF7ED] cursor-pointer text-[#1F2937] transition">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center shadow-sm">
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

          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#FFF7ED] cursor-pointer text-[#1F2937] transition">
            <div className="w-10 h-10 rounded-full bg-pink-100 text-[#EC4899] flex items-center justify-center shadow-sm">
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

          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#FFF7ED] cursor-pointer text-[#1F2937] transition">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
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
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#FFF7ED] text-[#1F2937] transition"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">Location</span>
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 z-30 p-3 rounded-2xl bg-white border border-[#FED7AA] shadow-xl max-w-xs grid grid-cols-6 gap-2 text-xl animate-scaleUp">
          {EMOJI_LIST.map((em, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setText((prev) => prev + em)}
              className="p-1 hover:scale-125 transition transform"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Input Row */}
      {isRecording ? (
        /* Voice Note Recording Overlay */
        <div className="flex items-center justify-between p-2 rounded-2xl bg-rose-50 border border-rose-200 text-[#F43F5E] animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold">Recording Voice Note...</span>
            <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-rose-200">
              {formatTimer(recordingDuration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="p-2 text-[#6B7280] hover:text-[#F43F5E] hover:bg-rose-100 rounded-full transition"
              title="Cancel recording"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white text-xs font-bold shadow-md shadow-orange-500/25 hover:opacity-90 flex items-center gap-1"
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
            className="p-2.5 rounded-full text-[#6B7280] hover:text-[#F97316] hover:bg-orange-50 transition cursor-pointer"
            title="Attach file or media"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 rounded-full text-[#6B7280] hover:text-[#F97316] hover:bg-orange-50 transition cursor-pointer"
            title="Emoji picker"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Message Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              disabled={disabled}
              placeholder="Type a message or use @ai to ask Gemini..."
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              className="w-full py-2.5 pl-4 pr-10 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:bg-white transition"
            />
          </div>

          {/* Send or Voice Record Button */}
          {text.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white shadow-md shadow-orange-500/25 transition cursor-pointer flex-shrink-0"
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className="p-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 text-[#F97316] transition cursor-pointer flex-shrink-0"
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

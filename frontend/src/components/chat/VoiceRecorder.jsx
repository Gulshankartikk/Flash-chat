import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Send, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

const VoiceRecorder = ({ onSendVoice, onCancel }) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    startRecording();
    return () => {
      stopCleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      toast.error("Microphone access denied or unavailable.");
      onCancel();
    }
  };

  const stopCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      stopCleanup();
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
        type: "audio/webm",
      });
      onSendVoice(audioFile, duration);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    }
  };

  const handleCancel = () => {
    stopCleanup();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    onCancel();
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 w-full bg-slate-100 dark:bg-[#1c1c1c] p-2.5 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] animate-fade-in">
      <button
        onClick={handleCancel}
        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        title="Discard recording"
      >
        <Trash2 size={18} />
      </button>

      {/* Recording pulse indicator & Timer */}
      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center gap-2">
          {recording && (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          )}
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-white">
            {formatTime(duration)}
          </span>
        </div>

        {/* Audio Wave preview */}
        {recording ? (
          <div className="flex items-center gap-0.5 flex-1 h-5 px-3">
            {[40, 70, 25, 90, 60, 30, 80, 50, 95, 30, 75, 45, 85, 20, 60, 80, 35, 90, 50].map(
              (height, idx) => (
                <span
                  key={idx}
                  className="w-1 bg-[#FF6B00] rounded-full animate-pulse"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${idx * 60}ms`,
                  }}
                />
              )
            )}
          </div>
        ) : (
          audioUrl && (
            <audio src={audioUrl} controls className="h-8 max-w-[220px] flex-1" />
          )
        )}
      </div>

      {/* Action Buttons */}
      {recording ? (
        <button
          onClick={handleStopRecording}
          className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
          title="Stop recording"
        >
          <Square size={16} />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!audioBlob}
          className="p-2 rounded-xl bg-[#FF6B00] text-white hover:bg-[#E05E00] transition-all shadow-md shadow-[#FF6B00]/20 disabled:opacity-50"
          title="Send voice note"
        >
          <Send size={16} />
        </button>
      )}
    </div>
  );
};

export default VoiceRecorder;

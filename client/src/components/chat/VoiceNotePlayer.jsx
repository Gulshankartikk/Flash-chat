import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export const VoiceNotePlayer = ({ url, duration = 0, isOwn = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const cycleSpeed = (e) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatSecs = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalDuration = duration || (audioRef.current?.duration && !isNaN(audioRef.current.duration) ? audioRef.current.duration : 15);
  const progressRatio = Math.min(currentTime / Math.max(totalDuration, 1), 1);

  // Decorative waveform bar heights
  const bars = [14, 22, 10, 18, 28, 12, 24, 16, 20, 30, 18, 10, 22, 26, 14, 20, 12, 18];

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl select-none ${
        isOwn ? 'bg-white/20 text-white' : 'bg-cream/70 text-ink border border-line'
      }`}
    >
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transition cursor-pointer ${
          isOwn ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-white hover:opacity-90'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
      </button>

      {/* Waveform & Scrubber */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-0.5 h-7">
          {bars.map((height, i) => {
            const barProgress = i / bars.length;
            const isFilled = barProgress <= progressRatio;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-all duration-150"
                style={{
                  height: `${height}px`,
                  backgroundColor: isFilled
                    ? isOwn
                      ? 'currentColor'
                      : 'var(--primary)'
                    : isOwn
                    ? 'rgba(255, 255, 255, 0.35)'
                    : 'var(--line)'
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
          <span>{formatSecs(currentTime > 0 ? currentTime : totalDuration)}</span>
          <span className="text-[10px] uppercase font-sans font-semibold">Voice Memo</span>
        </div>
      </div>

      {/* Speed Control Button */}
      <button
        type="button"
        onClick={cycleSpeed}
        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer shrink-0 ${
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-card border border-line hover:bg-cream text-primary'
        }`}
        title="Playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
};
export default VoiceNotePlayer;

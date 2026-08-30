import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

const AudioPlayer = ({ src, isMine }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * audio.duration;
    audio.currentTime = seekTime;
    setProgress((seekTime / audio.duration) * 100);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`p-2.5 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-sm ${
          isMine
            ? "bg-white text-[#FF6B00]"
            : "bg-[#FF6B00] text-white"
        }`}
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      {/* Progress Track & Waveform */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          onClick={handleSeek}
          className="h-3 w-full flex items-center gap-0.5 cursor-pointer group py-1"
        >
          {[35, 65, 20, 80, 50, 90, 40, 75, 30, 85, 60, 45, 95, 30, 70, 40, 80, 50, 65, 30].map(
            (height, idx) => {
              const barPercent = (idx / 20) * 100;
              const isPassed = progress >= barPercent;
              return (
                <span
                  key={idx}
                  style={{ height: `${height}%` }}
                  className={`w-1 rounded-full transition-colors ${
                    isPassed
                      ? isMine
                        ? "bg-white"
                        : "bg-[#FF6B00]"
                      : isMine
                      ? "bg-white/40"
                      : "bg-slate-300 dark:bg-[#444]"
                  }`}
                />
              );
            }
          )}
        </div>

        <div className="flex justify-between text-[10px] opacity-75 font-mono">
          <span>
            {formatTime(audioRef.current?.currentTime || 0)}
          </span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;

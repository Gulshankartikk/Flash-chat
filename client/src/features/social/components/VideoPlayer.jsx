import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { useSocialStore } from '../store/useSocialStore';

export const VideoPlayer = ({
  src,
  poster,
  className = '',
  aspectRatio = 'aspect-square',
  onDoubleTap
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControlFeedback, setShowControlFeedback] = useState(null); // 'play' | 'pause'

  const { isMuted, toggleMute } = useSocialStore();

  // Autoplay only when >60% visible
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            video
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => {
                // Autoplay policy prevented playback until user interaction
                setIsPlaying(false);
              });
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: [0, 0.6, 1.0]
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Update progress
  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(pct);
    }
  };

  // Tap to play/pause
  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        triggerFeedback('play');
      });
    } else {
      video.pause();
      setIsPlaying(false);
      triggerFeedback('pause');
    }
  };

  const triggerFeedback = (type) => {
    setShowControlFeedback(type);
    setTimeout(() => setShowControlFeedback(null), 600);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-black flex items-center justify-center select-none ${aspectRatio} ${className}`}
      onClick={togglePlay}
      onDoubleClick={onDoubleTap}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        loop
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-full object-cover"
      />

      {/* Center play/pause pulse feedback */}
      {showControlFeedback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white animate-ping">
            {showControlFeedback === 'play' ? (
              <Play className="w-8 h-8 fill-white" />
            ) : (
              <Pause className="w-8 h-8 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* Sound toggle button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        className="absolute bottom-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-10">
        <div
          className="h-full bg-gradient-to-r from-[#F97316] to-[#EC4899] transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

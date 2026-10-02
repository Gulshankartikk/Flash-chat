import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';

export const MediaCarousel = ({ media = [], onDoubleTapLike, aspectRatio = 'aspect-square' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef(0);

  if (!media || media.length === 0) {
    return (
      <div className={`w-full bg-[#FED7AA]/30 flex items-center justify-center ${aspectRatio}`}>
        <span className="text-xs text-[#6B7280]">No media available</span>
      </div>
    );
  }

  const handleTouchOrClick = (e) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      setShowHeartBurst(true);
      if (onDoubleTapLike) onDoubleTapLike();
      setTimeout(() => setShowHeartBurst(false), 900);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : prev));
  };

  const currentItem = media[currentIndex] || media[0];

  return (
    <div
      onClick={handleTouchOrClick}
      className={`relative w-full overflow-hidden bg-neutral-900 select-none ${aspectRatio}`}
    >
      {/* Active media item */}
      {currentItem.type === 'video' ? (
        <VideoPlayer
          src={currentItem.url}
          poster={currentItem.thumbnail}
          aspectRatio={aspectRatio}
          onDoubleTap={() => {
            setShowHeartBurst(true);
            if (onDoubleTapLike) onDoubleTapLike();
            setTimeout(() => setShowHeartBurst(false), 900);
          }}
        />
      ) : (
        <img
          src={currentItem.url}
          alt="Post media"
          loading="lazy"
          className="w-full h-full object-cover"
        />
      )}

      {/* Floating Animated Heart on double tap */}
      <AnimatePresence>
        {showHeartBurst && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 1] }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl filter drop-shadow-[0_10px_20px_rgba(244,63,94,0.6)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Arrows for multi-media */}
      {media.length > 1 && currentIndex > 0 && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/70 backdrop-blur-md text-[#1F2937] flex items-center justify-center shadow-md hover:bg-white transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {media.length > 1 && currentIndex < media.length - 1 && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/70 backdrop-blur-md text-[#1F2937] flex items-center justify-center shadow-md hover:bg-white transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Counter Pill top-right */}
      {media.length > 1 && (
        <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold">
          {currentIndex + 1}/{media.length}
        </div>
      )}

      {/* Dots Indicator at bottom */}
      {media.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm">
          {media.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

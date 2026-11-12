import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export const HeroCard = ({
  statusTag = '● System Live',
  headingWord = 'roll',
  description = 'Real-time encrypted messaging, social circles, encrypted personal vault, and intelligent Flash AI assistant synced across all devices.',
  stats = [
    { label: 'Active Chats', value: '18' },
    { label: 'Network', value: '64' },
    { label: 'Secured Vault', value: '28' }
  ],
  primaryBtnText = 'Start a Chat',
  secondaryBtnText = 'Explore Feed',
  onPrimaryClick,
  onSecondaryClick,
  progress = 84,
  avatars = [
    { name: 'Aria', src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=60' },
    { name: 'Dev', src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=60' },
    { name: 'Elena', src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=60' }
  ],
  className = ''
}) => {
  const circumference = 2 * Math.PI * 38; // ~238.76
  const strokeDashoffset = circumference - (circumference * progress) / 100;

  return (
    <div
      className={`coral-card p-6 sm:p-7 relative overflow-hidden transition-all duration-300 ${className}`}
    >
      <div className="flex flex-col min-[620px]:flex-row items-start min-[620px]:items-center justify-between gap-6">
        {/* Left Side Info */}
        <div className="flex-1 max-w-xl">
          {/* Status Tag Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-semibold tracking-wide mb-3 shadow-xs">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: '#ffffff' }}
            />
            <span>{statusTag}</span>
          </div>

          {/* Heading with Instrument Serif italic accent word */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Ready to{' '}
            <span className="font-serif-italic font-normal text-3xl sm:text-4xl lg:text-5xl text-white underline decoration-white/30 decoration-2 underline-offset-4">
              {headingWord}
            </span>{' '}
            into your day?
          </h2>

          {/* Short Text */}
          <p className="mt-2 text-xs sm:text-sm text-white/90 leading-relaxed line-clamp-2">
            {description}
          </p>

          {/* 3 Inline Stats with Dividers */}
          <div className="flex items-center gap-4 sm:gap-6 pt-3 pb-2 border-y border-white/20 my-4">
            {stats.map((st, idx) => (
              <React.Fragment key={idx}>
                <div className="flex-1 min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-white leading-none">
                    {st.value}
                  </div>
                  <div className="text-[11px] text-white/80 font-medium truncate mt-1">
                    {st.label}
                  </div>
                </div>
                {idx < stats.length - 1 && (
                  <div className="w-[1px] h-8 bg-white/25 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* 2 Buttons: Solid White + Ghost Outline */}
          <div className="flex items-center flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={onPrimaryClick}
              className="inline-flex items-center gap-2 bg-white text-[#d9503f] hover:bg-white/95 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-all duration-150 active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-white motion-reduce:transform-none"
            >
              <span>{primaryBtnText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onSecondaryClick}
              className="inline-flex items-center gap-1.5 border border-white/70 hover:bg-white/15 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-150 active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-white motion-reduce:transform-none"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{secondaryBtnText}</span>
            </button>
          </div>
        </div>

        {/* Right Side: Progress Ring & Avatars */}
        <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex-shrink-0 self-center min-[620px]:self-auto">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 90 90">
              <circle
                cx="45"
                cy="45"
                r="38"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="45"
                cy="45"
                r="38"
                stroke="#ffffff"
                strokeWidth="7"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <span className="text-xl font-black leading-none">{progress}%</span>
              <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider mt-1">
                Completed
              </span>
            </div>
          </div>

          {/* Around / under Progress Ring Avatars */}
          <div className="flex items-center -space-x-2 mt-2 pt-2 border-t border-white/15 w-full justify-center">
            {avatars.map((av, idx) => (
              <img
                key={idx}
                src={av.src}
                alt={av.name}
                title={av.name}
                className="w-6 h-6 rounded-full border-2 border-white object-cover shadow-xs"
              />
            ))}
            <div className="w-6 h-6 rounded-full bg-white/25 border-2 border-white text-white text-[9px] font-bold flex items-center justify-center">
              +4
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroCard;

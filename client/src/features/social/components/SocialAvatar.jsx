import React, { useState } from 'react';

/**
 * SocialAvatar with Instagram-style story ring
 * - Unseen story: gradient ring (from-[#F97316] to-[#EC4899])
 * - Seen story: muted ring (border-gray-300)
 * - Own / No story: clean border
 */
export const SocialAvatar = ({
  src,
  alt = 'User',
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  hasStory = false,
  hasUnseen = false,
  onClick,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeMap = {
    xs: { outer: 'w-7 h-7 p-[1px]', inner: 'w-6 h-6 text-[10px]' },
    sm: { outer: 'w-9 h-9 p-[1.5px]', inner: 'w-8 h-8 text-xs' },
    md: { outer: 'w-12 h-12 p-[2px]', inner: 'w-10 h-10 text-sm' },
    lg: { outer: 'w-16 h-16 p-[2.5px]', inner: 'w-14 h-14 text-base' },
    xl: { outer: 'w-24 h-24 p-[3px]', inner: 'w-20 h-20 text-2xl' }
  };

  const dimensions = sizeMap[size] || sizeMap.md;
  const initial = alt ? alt.trim().charAt(0).toUpperCase() : '⚡';

  const ringClasses = hasStory
    ? hasUnseen
      ? 'bg-gradient-to-tr from-[#F97316] via-[#EC4899] to-[#F43F5E] p-[2px]'
      : 'bg-gray-300 p-[2px]'
    : 'p-0';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 select-none ${
        onClick ? 'cursor-pointer hover:opacity-95 active:scale-95 transition-transform' : ''
      } ${className}`}
    >
      <div className={`rounded-full flex items-center justify-center ${ringClasses} ${dimensions.outer}`}>
        <div className={`rounded-full bg-white p-[1.5px] w-full h-full flex items-center justify-center overflow-hidden`}>
          {src && !imageError ? (
            <img
              src={src}
              alt={alt}
              onError={() => setImageError(true)}
              loading="lazy"
              className="w-full h-full object-cover rounded-full bg-[#FFF7ED]"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white font-bold flex items-center justify-center">
              {initial}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';

export const Avatar = ({
  src,
  alt = 'User Avatar',
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  isOnline = false,
  showStatus = false,
  className = '',
  onClick
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-28 h-28 text-3xl'
  };

  const statusSizeClasses = {
    xs: 'w-2 h-2 ring-1',
    sm: 'w-2.5 h-2.5 ring-1.5',
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-2',
    '2xl': 'w-5 h-5 ring-3'
  };

  const fallbackInitial = alt ? alt.trim().charAt(0).toUpperCase() : '⚡';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center flex-shrink-0 rounded-full select-none ${
        sizeClasses[size] || sizeClasses.md
      } ${onClick ? 'cursor-pointer hover:opacity-90 transition' : ''} ${className}`}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-full border border-[#FED7AA] bg-[#FFF7ED]"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white font-bold flex items-center justify-center border border-[#FED7AA] shadow-sm">
          {fallbackInitial}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-white ${
            statusSizeClasses[size] || statusSizeClasses.md
          } ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar;

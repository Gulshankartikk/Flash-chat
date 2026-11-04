import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-brand-gradient text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md z-40 relative">
      <div className="flex items-center gap-2 max-w-[85%] truncate">
        <WifiOff className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
        <span className="truncate">
          You are offline. Showing cached conversations & local Pocket notes.
        </span>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-lg text-[11px] font-bold transition active:scale-95 flex-shrink-0"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Retry</span>
      </button>
    </div>
  );
};

export default OfflineBanner;

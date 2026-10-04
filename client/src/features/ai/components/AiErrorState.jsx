import React from 'react';
import { AlertCircle, RefreshCw, WifiOff, ShieldAlert } from 'lucide-react';

export const AiErrorState = ({ error, onRetry, className = '' }) => {
  if (!error) return null;

  const isOffline = error.code === 'OFFLINE';
  const isBlocked = error.code === 'AI_BLOCKED';
  const isRateLimited = error.code === 'AI_RATE_LIMITED';

  const Icon = isOffline ? WifiOff : isBlocked ? ShieldAlert : AlertCircle;

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs ${className}`}
    >
      <Icon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold">{error.message || 'Something went wrong.'}</p>
        {isRateLimited && (
          <p className="mt-1 text-rose-600 dark:text-rose-300 text-[11px]">
            Please wait a moment or check back tomorrow when your daily quota resets.
          </p>
        )}
      </div>
      {onRetry && !isBlocked && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-200 dark:bg-rose-900/80 hover:bg-rose-300 font-medium text-[11px] text-rose-900 dark:text-rose-100 transition-colors shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

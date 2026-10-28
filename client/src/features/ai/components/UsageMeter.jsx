import React, { useEffect, useState } from 'react';
import { Sparkles, Info } from 'lucide-react';
import { fetchAiUsage } from '../api/aiApi';
import { useAiStore } from '../store/useAiStore';

export const UsageMeter = ({ compact = false, className = '' }) => {
  const usage = useAiStore((s) => s.usage);
  const setUsage = useAiStore((s) => s.setUsage);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadUsage = async () => {
      try {
        setLoading(true);
        const data = await fetchAiUsage();
        if (mounted && data) {
          setUsage(data);
        }
      } catch (_) {
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadUsage();
    return () => {
      mounted = false;
    };
  }, [setUsage]);

  const used = usage?.used || 0;
  const limit = usage?.limit || 50;
  const percentage = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const isNearLimit = percentage >= 80;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted ${className}`} title={`${used}/${limit} requests today`}>
        <div className="w-16 h-1.5 bg-line dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isNearLimit ? 'bg-rose-500' : 'bg-gradient-to-r from-primary to-secondary'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="font-semibold text-ink dark:text-cream">
          {used}/{limit}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-3.5 rounded-2xl bg-cream dark:bg-zinc-800/80 border border-line dark:border-zinc-700/80 ${className}`}>
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-1.5 font-semibold text-ink dark:text-cream">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Daily AI Usage</span>
        </div>
        <span className="text-muted font-medium">
          {used} of {limit} used ({limit - used} left)
        </span>
      </div>

      <div className="w-full h-2 bg-primary/20 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isNearLimit
              ? 'bg-rose-500'
              : 'bg-gradient-to-r from-primary via-secondary to-accent'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isNearLimit && (
        <p className="mt-2 text-[11px] text-rose-500 dark:text-rose-400 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          <span>Approaching daily quota. Quota resets at 00:00 UTC.</span>
        </p>
      )}
    </div>
  );
};

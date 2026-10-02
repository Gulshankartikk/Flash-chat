import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';

export const RelativeTime = ({ date, className = '' }) => {
  if (!date) return null;

  let timeString = '';
  try {
    const raw = formatDistanceToNowStrict(new Date(date), { addSuffix: false });
    // Transform "5 minutes" -> "5m", "2 hours" -> "2h", "1 day" -> "1d", "3 seconds" -> "3s"
    timeString = raw
      .replace(' seconds', 's')
      .replace(' second', 's')
      .replace(' minutes', 'm')
      .replace(' minute', 'm')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
      .replace(' months', 'mo')
      .replace(' month', 'mo')
      .replace(' years', 'y')
      .replace(' year', 'y');
  } catch (err) {
    timeString = '';
  }

  return <span className={`text-[#6B7280] text-xs ${className}`}>{timeString}</span>;
};

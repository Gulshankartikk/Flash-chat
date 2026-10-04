/**
 * Unified Formatting Utilities for Flash Chat
 */

export const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffInSeconds = Math.round((date.getTime() - now) / 1000);
  const absDiff = Math.abs(diffInSeconds);

  if (absDiff < 60) {
    return 'Just now';
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absDiff < 3600) {
    return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  }

  if (absDiff < 86400) {
    return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  }

  if (absDiff < 604800) {
    return rtf.format(Math.round(diffInSeconds / 86400), 'day');
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
};

export const formatCompactNumber = (number) => {
  if (number === null || number === undefined || isNaN(number)) return '0';

  const formatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  });

  return formatter.format(Number(number));
};

export const formatBytes = (bytes, decimals = 1) => {
  if (bytes === 0) return '0 B';
  if (!bytes) return '';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

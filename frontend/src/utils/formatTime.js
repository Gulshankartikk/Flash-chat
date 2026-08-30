

export function formatTimestamp(timestamp) {
  const now = Date.now();
  const messageTime = new Date(timestamp).getTime();
  const diff = now - messageTime;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

export const formatTime = formatTimestamp;
export default formatTimestamp;
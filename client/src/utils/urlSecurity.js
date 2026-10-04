/**
 * URL Security Utilities
 * Prevents open redirect attacks by ensuring paths are strictly internal.
 */

export const safeInternalPath = (path, fallback = '/chats') => {
  if (!path || typeof path !== 'string') return fallback;

  const trimmed = path.trim();

  // Reject protocol-relative or backslash-prefixed URLs (//evil.com, \\evil.com)
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\') || trimmed.startsWith('///')) {
    return fallback;
  }

  // Reject javascript:, data:, vbscript:, file: schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return fallback;
  }

  // If path starts with single slash (and not //), ensure it's a relative path
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    // Prevent backslash escaping e.g. /\evil.com
    if (trimmed.startsWith('/\\') || trimmed.includes('\\')) {
      return fallback;
    }
    return trimmed;
  }

  // If absolute URL provided, verify exact same origin
  try {
    const baseOrigin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://flashchat.app';

    const parsed = new URL(trimmed, baseOrigin);
    if (parsed.origin === baseOrigin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Malformed URL
  }

  return fallback;
};

export default safeInternalPath;

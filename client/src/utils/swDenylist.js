/**
 * Service Worker Cache Denylist Matcher
 * Explicitly forbids caching private, auth, pocket, AI, push, contacts, by-phone, pending, or upload routes
 */
export const isDenylisted = (url, request) => {
  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : 'http://localhost';
  const pathname = typeof url === 'string' ? new URL(url, origin).pathname : url.pathname;

  // Explicit forbidden API endpoints
  const denylistPrefixes = [
    '/api/auth',
    '/api/pocket',
    '/api/ai',
    '/api/contacts',
    '/api/support',
    '/api/push',
    '/api/upload',
    '/api/chats/by-phone',
    '/api/chats/pending',
    '/socket.io'
  ];

  if (denylistPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  // Never cache non-GET requests
  if (request && request.method && request.method !== 'GET') {
    return true;
  }

  // Never cache requests bearing the scoped private vault token
  if (request && request.headers && typeof request.headers.has === 'function' && request.headers.has('x-pocket-token')) {
    return true;
  }

  return false;
};

export default isDenylisted;

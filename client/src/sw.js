/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 1. Precache app shell defined by Vite build
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. Denylist helper: explicitly forbid caching private, auth, pocket, AI, push, or locked items
export const isDenylisted = (url, request) => {
  const pathname = typeof url === 'string' ? new URL(url, self.location.origin).pathname : url.pathname;
  
  // Explicit forbidden API endpoints
  const denylistPrefixes = [
    '/api/auth',
    '/api/pocket',
    '/api/ai',
    '/api/contacts',
    '/api/support',
    '/api/push',
    '/api/upload',
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
  if (request && request.headers && request.headers.has('x-pocket-token')) {
    return true;
  }

  return false;
};

// 3. Cache Google Fonts and Static Stylesheets
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })
    ]
  })
);

// 4. Cache Images & Avatars (Cloudinary, DiceBear, Unsplash)
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' ||
    url.origin.includes('cloudinary.com') ||
    url.origin.includes('dicebear.com'),
  new CacheFirst({
    cacheName: 'flash-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 14 })
    ]
  })
);

// 5. Safe Public API GET Caching (e.g. explore feeds, public profiles)
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    !isDenylisted(url, request) &&
    request.method === 'GET',
  new NetworkFirst({
    cacheName: 'flash-api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 5 }) // 5 minutes TTL
    ]
  })
);

// 6. Offline Navigation Fallback
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api/, /^\/socket\.io/]
});
registerRoute(navigationRoute);

setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return (await caches.match('/offline.html')) || Response.error();
  }
  return Response.error();
});

// 7. Message listener (Skip Waiting & Clear Caches on Logout)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_USER_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((k) => k.includes('flash-api') || k.includes('flash-images'))
            .map((k) => caches.delete(k))
        );
      })
    );
  }
});

// -----------------------------------------------------------------------------
// 8. WEB PUSH EVENT HANDLERS
// -----------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Flash Chat', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = data.title || '⚡ Flash Chat';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon.svg',
    badge: data.badge || '/icons/badge-72.svg',
    tag: data.tag || 'flash-chat-notification',
    renotify: data.renotify !== false,
    requireInteraction: data.data?.type === 'incoming_call',
    data: data.data || { url: '/chats' },
    actions: []
  };

  // Add contextual actions based on notification type
  if (data.data?.type === 'chat_message') {
    options.actions = [
      { action: 'open', title: '💬 Open Chat' }
    ];
  } else if (data.data?.type === 'incoming_call') {
    options.actions = [
      { action: 'accept_call', title: '📞 Answer' },
      { action: 'decline_call', title: '✕ Decline' }
    ];
  } else {
    options.actions = [
      { action: 'open', title: 'View' }
    ];
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If client is visible and focused, send in-app toast instead of showing system banner
      const focusedClient = clients.find((c) => c.visibilityState === 'visible' && c.focused);
      if (focusedClient) {
        focusedClient.postMessage({
          type: 'IN_APP_PUSH_NOTIFICATION',
          payload: { title, ...options }
        });
        return;
      }
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const action = event.action;

  let targetUrl = notifData.url || '/chats';

  // Security: validate that the url is relative or same origin
  try {
    const parsed = new URL(targetUrl, self.location.origin);
    if (parsed.origin !== self.location.origin) {
      targetUrl = '/chats';
    }
  } catch (e) {
    targetUrl = '/chats';
  }

  if (action === 'decline_call') {
    return;
  }

  if (action === 'accept_call') {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'autoAnswer=true';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });
      })
  );
});

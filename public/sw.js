// Minimal service worker — installability requirement for "Add to Home
// Screen" / "Install app" on most platforms. No offline caching: every
// request just passes straight through to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

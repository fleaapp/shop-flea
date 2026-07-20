// Kill-switch service worker. Replaces the previous app-shell SW so returning
// browsers evict stale caches and unregister. Native app already skips SW.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) =>
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(
        names
          .filter((n) => n.startsWith('flea-assets-'))
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
      const wins = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(wins.map((c) => c.navigate(c.url)));
    } finally {
      await self.registration.unregister();
    }
  })())
);

// Passthrough — do not intercept any requests.
self.addEventListener('fetch', () => {});

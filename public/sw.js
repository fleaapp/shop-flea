importScripts('/push-sw.js');

const ASSET_CACHE = 'flea-assets-v1';

// Hashed Vite assets are immutable — cache forever
const isImmutableAsset = (url) => {
  const path = new URL(url).pathname;
  return /^\/assets\/.*-[a-zA-Z0-9]{8,}\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|mov)$/.test(path);
};

// Supabase storage URLs (uploaded listing images, avatars)
const isStorageAsset = (url) => {
  return url.includes('/storage/v1/object/') || url.includes('/storage/v1/render/');
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean old non-asset caches
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name !== ASSET_CACHE)
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
    // NOTE: Do NOT force-navigate clients here. Reloading open tabs during
    // activate races with in-flight auth flows (sign-in tokens that haven't
    // been persisted to localStorage yet), causing users to be bounced back
    // to /auth right after a successful login. Updates apply on next natural
    // navigation; that's good enough.
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = request.url;

  // Cache-first for immutable hashed assets
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // Stale-while-revalidate for storage assets (avatars, listing images)
  if (isStorageAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        const networkPromise = fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => undefined);

        // Return cached immediately if available, refresh in background
        if (cached) return cached;

        const networkResponse = await networkPromise;
        return networkResponse || new Response('', { status: 504 });
      })
    );
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

console.log('[sw] Asset-caching service worker loaded');

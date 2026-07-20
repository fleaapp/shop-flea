## Diagnosis

That's not "just PWA" — it's a real bug caused by an app-shell service worker (`public/sw.js`) we register on web. It:

- Precaches every hashed Vite asset and serves them cache-first.
- Runs stale-while-revalidate on Supabase storage.
- On activate, calls `clients.navigate(client.url)` on every open window to force-refresh installed PWAs.

That last step is what produces the "white screen → skeleton stuck → can't switch screens" flow. When a new SW activates, every installed tab reloads mid-render, and if any hashed chunk referenced by the previous HTML is missing from the new build, cache-first happily returns stale JS that no longer matches the new HTML — the router mounts, hydrates against nothing, and freezes on skeletons. It also silently interferes with client-side navigation until the SW cycle completes.

Since we're only shipping the native app (Capacitor already skips this SW via `isNativePlatform`), there is zero reason to keep an app-shell SW on the web. Web push is not in use on the browser build either.

## Fix — kill-switch the app-shell SW (per PWA skill)

1. **Replace `public/sw.js` with a kill-switch worker.** Same path so returning browsers pick it up, then it deletes its own caches and unregisters itself. Only touches its own `flea-assets-*` caches — leaves any other origin-scoped caches alone.

    ```js
    // public/sw.js
    self.addEventListener('install', () => self.skipWaiting());

    self.addEventListener('activate', (event) =>
      event.waitUntil((async () => {
        try {
          const names = await caches.keys();
          await Promise.allSettled(
            names.filter((n) => n.startsWith('flea-assets-')).map((n) => caches.delete(n))
          );
          await self.clients.claim();
          const wins = await self.clients.matchAll({ type: 'window' });
          await Promise.allSettled(wins.map((c) => c.navigate(c.url)));
        } finally {
          await self.registration.unregister();
        }
      })())
    );

    self.addEventListener('fetch', () => {}); // no-op, passthrough
    ```

2. **Stop registering the SW in `src/main.tsx`.** Replace `registerAppServiceWorker()` with an unconditional unregister of any `/sw.js` registration (keeps the cleanup path for users who still have the old worker). Remove the `controllerchange` reload listener since there's no controller anymore. Leave the `isNativePlatform` guard intact.

3. **Leave `public/push-sw.js` in place, untouched.** Per the PWA skill, messaging workers are outside app-shell cleanup. It's imported only via the old sw.js `importScripts`, so once sw.js is a kill switch it becomes inert but the file staying avoids 404s for any transitional state.

4. **Leave `public/manifest.webmanifest` alone.** Manifest-only install still works for anyone who wants to save the web build to home screen; it just won't have offline/cache behavior — which is what we want.

## Result

- Returning web/PWA users pick up the replacement SW once, it wipes the stale asset cache, unregisters, and future loads are plain network — no more stuck skeletons or frozen navigation.
- Native app is unaffected (already skipped SW).
- One release cycle from now the kill switch has run for essentially all users and we can delete `public/sw.js` and `public/push-sw.js` entirely.

## Verification

After deploy, in a browser that had the old PWA installed: open DevTools → Application → Service Workers, confirm the SW deactivates and unregisters, `flea-assets-*` caches are gone, and navigating between screens no longer hangs on skeletons.

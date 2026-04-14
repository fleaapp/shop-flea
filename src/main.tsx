import { createRoot } from "react-dom/client";
// Eagerly preload all static assets before React renders
import "./utils/preloadAssets";
import App from "./App.tsx";
import "./index.css";

// Detect Android and add class to html for platform-specific CSS
if (/android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('android');
}

const BUILD_ID = (import.meta.env.VITE_BUILD_ID as string | undefined) ?? '0';
const STORED_BUILD_KEY = 'flea_build_id';
const SW_URL = `/sw.js?build=${encodeURIComponent(BUILD_ID)}`;

const clearAppCaches = async () => {
  if (typeof caches === 'undefined') return;

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
};

const unregisterServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

const resetAppCache = async () => {
  await Promise.all([clearAppCaches(), unregisterServiceWorkers()]);
};

// PWA: Prevent service worker registration in iframes/preview environments
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;

  let reloadingForServiceWorker = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForServiceWorker) return;
    reloadingForServiceWorker = true;
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });

    await registration.update().catch(() => undefined);

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  } catch (error) {
    console.error('[service-worker] Registration failed', error);
  }
};

if (isPreviewHost || isInIframe) {
  void resetAppCache();
  const storedBuild = localStorage.getItem(STORED_BUILD_KEY);

  if (storedBuild && storedBuild !== BUILD_ID) {
    console.log('[cache-bust] New build detected, clearing old caches…');
    void clearAppCaches();
  }

  localStorage.setItem(STORED_BUILD_KEY, BUILD_ID);
  void registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);

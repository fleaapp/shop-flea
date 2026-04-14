import { createRoot } from "react-dom/client";
// Eagerly preload all static assets before React renders
import "./utils/preloadAssets";
import App from "./App.tsx";
import "./index.css";

// Detect Android and add class to html for platform-specific CSS
if (/android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('android');
}

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

if (isPreviewHost || isInIframe) {
  void resetAppCache();
} else if ('serviceWorker' in navigator) {
  let reloadingForServiceWorker = false;

  // BUILD_ID changes every deploy — if it differs from what's stored, nuke all caches
  const BUILD_ID = import.meta.env.VITE_BUILD_ID as string ?? '0';
  const STORED_BUILD_KEY = 'flea_build_id';
  const storedBuild = localStorage.getItem(STORED_BUILD_KEY);

  if (storedBuild && storedBuild !== String(BUILD_ID)) {
    // New deploy detected — clear everything
    console.log('[cache-bust] New build detected, clearing caches…');
    localStorage.setItem(STORED_BUILD_KEY, String(BUILD_ID));
    void resetAppCache().finally(() => {
      window.location.reload();
    });
  } else {
    localStorage.setItem(STORED_BUILD_KEY, String(BUILD_ID));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForServiceWorker) return;
      reloadingForServiceWorker = true;
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        registration?.update().catch(() => undefined);

        registration?.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller && !reloadingForServiceWorker) {
              reloadingForServiceWorker = true;
              window.location.reload();
            }
          });
        });
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./components/dev/InAppDebugOverlay"; // installs console/error hooks at boot
import { restoreRouteAppChrome } from "./lib/appChrome.ts";
import { installNetLogger } from "./lib/netLogger.ts";

// Install network logger BEFORE any other code makes requests (Supabase, etc.)
installNetLogger();

restoreRouteAppChrome();
window.addEventListener('pageshow', restoreRouteAppChrome, { capture: true });
window.addEventListener('focus', restoreRouteAppChrome, { capture: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) restoreRouteAppChrome();
}, { capture: true });

// Detect Android and add class to html for platform-specific CSS
if (/android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('android');
}

// Detect installed/standalone (PWA home-screen or Capacitor native) for platform-specific spacing
const detectInstalled = () => {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    !!(window as any).Capacitor?.isNativePlatform?.();
  document.documentElement.classList.toggle('is-installed', isStandalone);
};
detectInstalled();
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', detectInstalled);

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
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: '/',
      updateViaCache: 'none',
    });

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
} else {
  const storedBuild = localStorage.getItem(STORED_BUILD_KEY);

  if (storedBuild && storedBuild !== BUILD_ID) {
    console.log('[cache-bust] New build detected, clearing old caches…');
    void clearAppCaches();
  }

  localStorage.setItem(STORED_BUILD_KEY, BUILD_ID);
  void registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);

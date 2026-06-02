import { createRoot } from "react-dom/client";
import { SplashScreen } from '@capacitor/splash-screen';
import App from "./App.tsx";
import "./index.css";
import { restoreRouteAppChrome } from "./lib/appChrome.ts";

restoreRouteAppChrome();

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

// Detect native platform early so we can skip web-only boot work
// (cache purges, service-worker reloads) that would otherwise double
// the perceived splash time on iOS/Android cold boot.
const isNativePlatform =
  window.location.protocol === 'capacitor:' ||
  !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

// One-time marketplace reset purge: clears ALL stale client-side state
// (localStorage, sessionStorage, Cache Storage, service workers) left
// behind after the server-side data wipe. Bump the version to trigger again.
// Skipped on native — the WebView ships a fresh `dist/` with every build
// and has no service worker to clear, so the reload-after-purge here was
// causing iOS to boot twice on first launch.
const MARKETPLACE_RESET_VERSION = '2026-05-31-wipe-3';
const MARKETPLACE_RESET_KEY = 'flea_marketplace_reset_version';
let needsMarketplaceReset = false;
try {
  needsMarketplaceReset =
    !isNativePlatform &&
    localStorage.getItem(MARKETPLACE_RESET_KEY) !== MARKETPLACE_RESET_VERSION;
} catch {
  needsMarketplaceReset = false;
}

if (needsMarketplaceReset) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === MARKETPLACE_RESET_KEY) continue;
      if (key.startsWith('sb-')) continue; // preserve Supabase auth session
      if (
        key.startsWith('flea_') ||
        key.startsWith('saved-listing-snapshots') ||
        key.startsWith('rq-') ||
        key.toLowerCase().includes('react-query') ||
        key.toLowerCase().includes('query-cache')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.clear(); } catch {}
    localStorage.setItem(MARKETPLACE_RESET_KEY, MARKETPLACE_RESET_VERSION);
    console.log('[reset] purged', keysToRemove.length, 'stale marketplace cache keys');

    // Nuke Cache Storage + service workers, then hard reload so the user
    // sees the truly-empty backend instead of cached HTML/JSON responses.
    (async () => {
      try {
        if (typeof caches !== 'undefined') {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch (err) {
        console.warn('[reset] cache/SW purge failed', err);
      } finally {
        location.reload();
      }
    })();
  } catch (err) {
    console.warn('[reset] marketplace purge failed', err);
  }
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

// `isNativePlatform` is declared earlier in this file (above the marketplace
// reset block) so it can gate the web-only cache purge.

const hideNativeSplash = () => {
  if (!isNativePlatform) return;
  void SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => undefined);
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Hide native splash AFTER React has actually rendered the first frame
// (Auth screen). Hiding it earlier exposes the lime WebView background
// for hundreds of ms — that's the "green screen" gap users were seeing.
if (isNativePlatform) {
  requestAnimationFrame(() => requestAnimationFrame(hideNativeSplash));
  // Safety fallbacks in case rAF is throttled during cold boot
  window.setTimeout(hideNativeSplash, 400);
  window.setTimeout(hideNativeSplash, 1500);
}

const root = createRoot(document.getElementById("root")!);
void import("./App.tsx").then(({ default: App }) => root.render(<App />));

// Explicitly hide the native splash screen as soon as React has rendered.
// Without this, Capacitor's default auto-hide timeout fires (visible in Xcode
// as "SplashScreen was automatically hidden after default timeout"), which
// leaves the splash covering the WebView for ~3s and looks like a stall.
if (isNativePlatform) {
  requestAnimationFrame(hideNativeSplash);
  window.setTimeout(hideNativeSplash, 250);
  window.setTimeout(hideNativeSplash, 1000);
}

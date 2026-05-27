import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./components/dev/InAppDebugOverlay"; // installs console/error hooks at boot
import { restoreRouteAppChrome } from "./lib/appChrome.ts";
import { installNetLogger } from "./lib/netLogger.ts";

// Install network logger BEFORE any other code makes requests (Supabase, etc.)
installNetLogger();

// Native boot diagnostics — visible in Xcode/Web Inspector to confirm
// which route the WebView actually opened, and whether the Capacitor
// bridge is present yet. Helps disambiguate "stuck on green hourglass".
try {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  console.log('[boot]', JSON.stringify({
    href: window.location.href,
    pathname: window.location.pathname,
    protocol: window.location.protocol,
    native: !!cap?.isNativePlatform?.(),
    platform: cap?.getPlatform?.() ?? 'web',
    ua: navigator.userAgent.slice(0, 80),
  }));
} catch {}

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

const isNativePlatform =
  window.location.protocol === 'capacitor:' ||
  !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

const hideNativeSplash = () => {
  if (!isNativePlatform) return;
  void import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => {
      void SplashScreen.hide({ fadeOutDuration: 0 })
        .then(() => console.log('[boot] splash hidden'))
        .catch((err) => console.warn('[boot] splash hide failed', err));
    })
    .catch((err) => console.warn('[boot] splash plugin failed', err));
};

if (isNativePlatform) {
  console.log('[boot] native bundle marker', JSON.stringify({ buildId: BUILD_ID, href: window.location.href }));
  hideNativeSplash();
}

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

if (isNativePlatform) {
  // On native, the WebView already manages its own cache. Wiping caches and
  // unregistering service workers on every launch slows down first paint
  // (which previously made loading screens look "stuck") — skip it.
} else if (isPreviewHost || isInIframe) {
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

// Explicitly hide the native splash screen as soon as React has rendered.
// Without this, Capacitor's default auto-hide timeout fires (visible in Xcode
// as "SplashScreen was automatically hidden after default timeout"), which
// leaves the splash covering the WebView for ~3s and looks like a stall.
if (isNativePlatform) {
  requestAnimationFrame(hideNativeSplash);
  window.setTimeout(hideNativeSplash, 250);
  window.setTimeout(hideNativeSplash, 1000);
}

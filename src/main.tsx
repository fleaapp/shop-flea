import { createRoot } from "react-dom/client";
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import App from "./App.tsx";
import "./index.css";
import { restoreRouteAppChrome } from "./lib/appChrome.ts";
import { installIosGoogleSafariGuard } from "./lib/iosGoogleSafariGuard.ts";
import { installGlobalErrorHandlers } from "./lib/errorLogger.ts";
import { installStaleChunkGuard } from "./lib/staleChunkRecovery.ts";

restoreRouteAppChrome();
installIosGoogleSafariGuard();
installStaleChunkGuard();
installGlobalErrorHandlers();

// Native keyboard: keep iOS' normal focused-input visibility, but expose the
// keyboard height so only fixed chat composers lift above it. Do not globally
// disable WebKit scroll-to-focused-input — that can leave fields hidden behind
// the keyboard on native.
if (Capacitor.isNativePlatform()) {
  // App-wide: keep the focused input visible above the native keyboard.
  // Most screens use `fixed inset-0` shells with an inner `overflow-y-auto`
  // scroll container. WebKit's built-in scroll-to-focused-input only walks
  // the document scroller — it doesn't scroll inner containers, so a focused
  // field inside them can stay behind the keyboard. This handler finds the
  // nearest scrollable ancestor and nudges the focused element into view
  // above the current --native-keyboard-height.
  const MARGIN_ABOVE_KEYBOARD = 24;

  const getKeyboardHeight = (): number => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--native-keyboard-height')
      .trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const findScrollParent = (el: HTMLElement | null): HTMLElement | Window => {
    let node: HTMLElement | null = el?.parentElement ?? null;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const oy = style.overflowY;
      if (oy === 'auto' || oy === 'scroll') {
        return node;
      }
      node = node.parentElement;
    }
    return window;
  };

  // Track the scroll parent we've padded so we can restore it on hide.
  let paddedScrollParent: HTMLElement | null = null;

  const applyKeyboardPadding = (parent: HTMLElement, kb: number) => {
    if (kb <= 0) return;
    if (paddedScrollParent && paddedScrollParent !== parent) {
      restoreKeyboardPadding();
    }
    if (!('fleaKbPadRestore' in parent.dataset)) {
      parent.dataset.fleaKbPadRestore = parent.style.paddingBottom || '';
    }
    const base = parseFloat(parent.dataset.fleaKbPadRestore || '0') || 0;
    parent.style.paddingBottom = `${base + kb + MARGIN_ABOVE_KEYBOARD}px`;
    paddedScrollParent = parent;
  };

  const restoreKeyboardPadding = () => {
    if (!paddedScrollParent) return;
    const original = paddedScrollParent.dataset.fleaKbPadRestore ?? '';
    paddedScrollParent.style.paddingBottom = original;
    delete paddedScrollParent.dataset.fleaKbPadRestore;
    paddedScrollParent = null;
  };

  const isEditable = (el: EventTarget | null): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLInputElement) {
      const t = (el.type || '').toLowerCase();
      // Skip inputs that don't open a keyboard.
      if (['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(t)) return false;
      return true;
    }
    if (el instanceof HTMLTextAreaElement) return true;
    if (el.isContentEditable) return true;
    return false;
  };

  const ensureFocusedVisible = (el: HTMLElement) => {
    // Chat composers translate themselves above the keyboard already.
    if (el.closest('.native-keyboard-lift')) return;

    const kb = getKeyboardHeight();
    const parent = findScrollParent(el);

    // Give the scroll container room to lift the field above the keyboard,
    // even when its content otherwise fits within the viewport.
    if (kb > 0 && parent !== window) {
      applyKeyboardPadding(parent as HTMLElement, kb);
    }

    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const safeBottom = viewportH - kb - MARGIN_ABOVE_KEYBOARD;

    if (rect.bottom <= safeBottom && rect.top >= 0) return; // already visible

    const delta = rect.bottom - safeBottom;
    if (delta <= 0 && rect.top >= 0) return;

    if (parent === window) {
      window.scrollBy({ top: delta, behavior: 'smooth' });
    } else {
      (parent as HTMLElement).scrollBy({ top: delta, behavior: 'smooth' });
    }
  };

  let lastFocused: HTMLElement | null = null;

  document.addEventListener(
    'focusin',
    (e) => {
      if (!isEditable(e.target)) return;
      lastFocused = e.target as HTMLElement;
      // First pass immediately, then again after keyboard height is reported.
      requestAnimationFrame(() => ensureFocusedVisible(lastFocused!));
      window.setTimeout(() => {
        if (lastFocused && document.activeElement === lastFocused) {
          ensureFocusedVisible(lastFocused);
        }
      }, 300);
    },
    true,
  );

  document.addEventListener(
    'focusout',
    () => {
      lastFocused = null;
    },
    true,
  );

  void import('@capacitor/keyboard')
    .then(({ Keyboard }) => {
      const resetKeyboardHeight = () => {
        document.documentElement.style.setProperty('--native-keyboard-height', '0px');
      };
      void Keyboard.addListener('keyboardWillShow', (info) => {
        const keyboardHeight = Math.max(0, Number(info.keyboardHeight) || 0);
        document.documentElement.style.setProperty('--native-keyboard-height', `${keyboardHeight}px`);
        // Re-run visibility after the OS reports the real keyboard height.
        if (lastFocused && document.activeElement === lastFocused) {
          requestAnimationFrame(() => ensureFocusedVisible(lastFocused!));
        }
      });
      void Keyboard.addListener('keyboardDidShow', () => {
        if (lastFocused && document.activeElement === lastFocused) {
          ensureFocusedVisible(lastFocused);
        }
      });
      void Keyboard.addListener('keyboardDidHide', resetKeyboardHeight);
      void Keyboard.addListener('keyboardWillHide', resetKeyboardHeight);
    })
    .catch(() => undefined);
}


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

// App-shell service worker has been retired. We now ship native only, and the
// previous SW was causing stuck skeletons / frozen navigation for web/PWA
// users. `public/sw.js` is now a kill switch that unregisters itself; here we
// also proactively unregister any lingering `/sw.js` registration and wipe the
// old asset caches so returning browsers recover on next load.
const unregisterAppServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((r) => r.active?.scriptURL.includes('/sw.js') || r.installing?.scriptURL.includes('/sw.js') || r.waiting?.scriptURL.includes('/sw.js'))
        .map((r) => r.unregister()),
    );
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('flea-assets-')).map((n) => caches.delete(n)),
      );
    }
  } catch (err) {
    console.warn('[sw] cleanup failed', err);
  }
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

void unregisterAppServiceWorker();


// Hide native splash AFTER React has rendered the first frame (Auth screen).
if (isNativePlatform) {
  requestAnimationFrame(() => requestAnimationFrame(hideNativeSplash));
  window.setTimeout(hideNativeSplash, 400);
  window.setTimeout(hideNativeSplash, 1500);
}

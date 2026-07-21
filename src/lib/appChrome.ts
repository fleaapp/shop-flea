const AUTH_TOP_COLOR = '#DDFED7';
const APP_TOP_COLOR = '#F5F1EB';
const OVERLAY_TOP_COLOR = '#00000000';

let nativeChromeRequest = 0;
let activeOverlayCount = 0;

const getRouteTopColor = () => {
  const pathname = window.location.pathname;
  const isAuthLike = /^\/(auth|forgot-password|reset-password|verify-email)(\/|$)/.test(pathname);
  if (isAuthLike) return AUTH_TOP_COLOR;
  // On native cold boot the WebView opens at '/' before React redirects to /auth.
  // If no Supabase auth token is present AND the user is not browsing as a guest,
  // paint lime to avoid a cream flash before the /auth redirect.
  try {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const isNative = !!cap?.isNativePlatform?.() || window.location.protocol === 'capacitor:';
    if (isNative && (pathname === '/' || pathname === '')) {
      let hasAuthToken = false;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.includes('-auth-token')) { hasAuthToken = true; break; }
      }
      let isGuest = false;
      try { isGuest = sessionStorage.getItem('flea_guest_mode') === '1'; } catch {}
      if (!hasAuthToken && !isGuest) return AUTH_TOP_COLOR;
    }
  } catch {}
  return APP_TOP_COLOR;
};


let lastAppliedColor: string | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let overlaysWebViewInitialized = false;

// Cached route color (used only for the native strip's route paint).
let cachedRouteColor: string = APP_TOP_COLOR;

const isNativeBridgeReady = (): boolean => {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return false;
  // Avoid calling StatusBar before the native bridge has registered its plugins.
  return cap.isPluginAvailable?.('StatusBar') ?? true;
};

// Route-color path: debounced to avoid thrash during navigation.
// The native strip ALWAYS shows the raw route color — overlay dimming is
// handled by a DOM overlay (see ensureTintEl / setOverlayTintVisible below),
// so we never animate the native background and never see iOS's icon-lag
// crossfade on drawer close.
const syncNativeStatusBarRoute = (color: string) => {
  if (color === lastAppliedColor) return;
  const requestId = ++nativeChromeRequest;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (!isNativeBridgeReady()) return;
    void Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')])
      .then(([{ Capacitor }, { StatusBar, Style }]) => {
        if (requestId !== nativeChromeRequest) return;
        if (!Capacitor.isNativePlatform()) return;
        lastAppliedColor = color;
        // Keep the WebView layout stable — set overlaysWebView false exactly
        // once, never toggle it, so it never resizes.
        if (!overlaysWebViewInitialized) {
          overlaysWebViewInitialized = true;
          void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
        }
        void StatusBar.setBackgroundColor({ color }).catch(() => undefined);
        void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      })
      .catch(() => undefined);
  }, 60);
};

// DOM overlay that dims the safe-area top strip. Fades with the same 200ms
// ease as the Radix/Vaul backdrop, so the status-bar area dims together
// with the rest of the screen — no layout shift, no native color animation,
// no icon-lag flash.
const TINT_EL_ID = 'lv-statusbar-tint';
const ensureTintEl = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(TINT_EL_ID) as HTMLElement | null;
  if (el) return el;
  el = document.createElement('div');
  el.id = TINT_EL_ID;
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: 'env(safe-area-inset-top, 0px)',
    background: 'hsl(var(--foreground) / 0.5)',
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 200ms ease',
    willChange: 'opacity',
  } as CSSStyleDeclaration);
  (document.body ?? document.documentElement).appendChild(el);
  return el;
};

const setOverlayTintVisible = (visible: boolean) => {
  const el = ensureTintEl();
  if (!el) return;
  // Force a style read so the transition applies even when set in the same
  // frame the element is created.
  void el.offsetWidth;
  el.style.opacity = visible ? '1' : '0';
};




// Parse "H S% L%" (the shape Tailwind stores in --foreground) to hex.
const hslTripleToHex = (triple: string): string | null => {
  const m = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(triple);
  if (!m) return null;
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
};

// Compose the current `--foreground` token at 50% over the route colour to
// exactly match Radix's `bg-foreground/50` overlay. Falls back to the
// charcoal token literal (#29303D) if the CSS variable can't be read.
const overlayTint = (routeHex: string): string => {
  let fgHex = '#29303D';
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--foreground');
    const parsed = raw && hslTripleToHex(raw);
    if (parsed) fgHex = parsed;
  } catch { /* fall through */ }
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(routeHex);
  if (!fg || !bg) return routeHex;
  const a = 0.5;
  const mix = (i: number) => Math.round(fg[i] * a + bg[i] * (1 - a)).toString(16).padStart(2, '0');
  return `#${mix(0)}${mix(1)}${mix(2)}`;
};

export const applyAppChromeColor = (color: string, _statusBarStyle: 'default' | 'black-translucent' = 'default') => {
  // The overlay-style branch used to also rewrite CSS vars, meta tags and
  // classes on every drawer open/close — that caused reflow flashes near the
  // status bar. Overlay push/pop is now handled exclusively by
  // setStatusBarOverlayTint, which only recolors the native strip.
  const routeTopColor = getRouteTopColor();
  const isAuthColor = routeTopColor === AUTH_TOP_COLOR;

  // Always keep the cached route color + its overlay tint in sync so the
  // next overlay push has a correct tint ready — even on the very first
  // paint where routeTopColor already equals the initial cached value.
  cachedRouteColor = routeTopColor;
  cachedRouteTint = overlayTint(routeTopColor);


  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'light';
  document.documentElement.style.setProperty('--app-top-bg', routeTopColor);
  document.body?.style.setProperty('--app-top-bg', routeTopColor);
  document.documentElement.style.backgroundColor = routeTopColor;
  if (document.body) document.body.style.backgroundColor = routeTopColor;

  // Keep #root in sync with route chrome so auth-like routes (and native
  // cold boot) paint lime end-to-end, while in-app routes restore cream.
  if (isAuthColor) {
    document.documentElement.style.setProperty('--background', '111 95% 92%');
    document.documentElement.classList.add('boot-auth');
  } else {
    document.documentElement.style.removeProperty('--background');
    document.documentElement.classList.remove('boot-auth');
  }

  const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  theme?.setAttribute('content', routeTopColor);

  const colorScheme = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  colorScheme?.setAttribute('content', 'light');

  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  status?.setAttribute('content', 'default');

  syncNativeStatusBarRoute(routeTopColor);
  // Preserve unused-arg lint quiet without changing external API.
  void color;
};


const applyRouteAppChrome = () => {
  applyAppChromeColor(getRouteTopColor());
};

export const restoreRouteAppChrome = () => {
  applyRouteAppChrome();
  // If an overlay is still up (e.g. resume while a drawer is open), keep the
  // status bar dimmed — the route write above respects activeOverlayCount.
};

// Always re-assert `overlaysWebView:false` on the native side and re-paint
// the status strip. Native plugins (Camera, Share, Wallet) can cause iOS to
// silently revert the overlay flag when they dismiss, which slides the
// WebView under the notch and clips every screen's top row. Calling this
// after a native return closes that window without a fresh app launch.
const reassertOverlayFalse = () => {
  if (!isNativeBridgeReady()) return;
  const requestId = ++nativeChromeRequest;
  const targetColor = activeOverlayCount > 0 ? cachedRouteTint : cachedRouteColor;
  void Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')])
    .then(([{ Capacitor }, { StatusBar, Style }]) => {
      if (requestId !== nativeChromeRequest) return;
      if (!Capacitor.isNativePlatform()) return;
      void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: targetColor }).catch(() => undefined);
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      lastAppliedColor = targetColor;
    })
    .catch(() => undefined);
};

export const forceRestoreRouteAppChrome = () => {
  // Reset guards so the route write below always re-pushes the native flag,
  // not just the color.
  lastAppliedColor = null;
  applyRouteAppChrome();
  reassertOverlayFalse();
};

// While an overlay (Dialog/Sheet/Drawer/AlertDialog) is mounted, dim the
// native status-bar strip to match the Radix bg-foreground/50 backdrop.
// Nothing in the WebView layout moves — only the native strip color changes.
export const pushOverlayAppChrome = () => {
  activeOverlayCount += 1;
  if (activeOverlayCount === 1) {
    setStatusBarOverlayTint(true);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeOverlayCount = Math.max(0, activeOverlayCount - 1);
    if (activeOverlayCount === 0) {
      setStatusBarOverlayTint(false);
    }
  };
};

// Web visibility re-apply + a SINGLE native resume listener.
// Previously these were also registered in src/App.tsx, which caused the
// duplicate `App addListener` floods visible in Xcode and raced the bridge
// during boot. Keep registration here only, gated to run exactly once.
let resumeListenersInstalled = false;
const installResumeListeners = () => {
  if (resumeListenersInstalled || typeof window === 'undefined') return;
  resumeListenersInstalled = true;

  const reapply = () => forceRestoreRouteAppChrome();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reapply();
  });
  window.addEventListener('pageshow', reapply);
  window.addEventListener('focus', reapply);

  // Native resume/appStateChange — registered ONCE, only after the bridge
  // is actually present, to avoid `JS Eval error` races during cold boot.
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    // Defer until the next tick so the Capacitor JS bridge has finished
    // wiring `window.Capacitor.triggerEvent` before we add native listeners.
    setTimeout(() => {
      void import('@capacitor/app')
        .then(({ App }) => {
          void App.addListener('resume', reapply).catch(() => undefined);
          void App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) reapply();
          }).catch(() => undefined);
        })
        .catch(() => undefined);
    }, 0);
  }
};

installResumeListeners();

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
let lastAppliedOverlay: boolean | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

const isNativeBridgeReady = (): boolean => {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return false;
  // Avoid calling StatusBar before the native bridge has registered its plugins.
  return cap.isPluginAvailable?.('StatusBar') ?? true;
};

const syncNativeStatusBar = (color: string, isOverlay: boolean) => {
  // Only switch the native status bar to transparent overlay mode WHILE a
  // Drawer/Dialog/Sheet/AlertDialog is open, so the dim backdrop blends over
  // the status bar. In normal (non-overlay) state the status bar is a solid
  // strip matching the route colour and the WebView sits below it — no
  // per-page safe-area padding required.
  if (color === lastAppliedColor && isOverlay === lastAppliedOverlay) return;
  const requestId = ++nativeChromeRequest;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (!isNativeBridgeReady()) return;
    void Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')])
      .then(([{ Capacitor }, { StatusBar, Style }]) => {
        if (requestId !== nativeChromeRequest) return;
        if (!Capacitor.isNativePlatform()) return;
        const prevOverlay = lastAppliedOverlay;
        lastAppliedColor = color;
        lastAppliedOverlay = isOverlay;
        // Keep the WebView layout stable at all times — never toggle
        // setOverlaysWebView on overlay open/close, which would resize the
        // WebView by the status-bar height and cause a visible jump near
        // the top of the screen. Ensure overlay mode is off exactly once.
        if (prevOverlay === null) {
          void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
        }
        // Only the status-bar strip's background colour changes: dim it
        // when an overlay (Drawer/Sheet/Dialog) is open so the strip
        // blends with the Radix bg-foreground/50 backdrop, restore route
        // colour otherwise. Style stays Dark so icons don't flicker.
        const stripColor = isOverlay ? overlayTint(color) : color;
        void StatusBar.setBackgroundColor({ color: stripColor }).catch(() => undefined);
        void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      })
      .catch(() => undefined);
  }, 60);
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

export const applyAppChromeColor = (color: string, statusBarStyle: 'default' | 'black-translucent' = 'default') => {
  const isOverlay = statusBarStyle === 'black-translucent';
  const routeTopColor = getRouteTopColor();
  // Never repaint the WebView top strip to the transparent overlay value —
  // that caused a visible flash near the status bar when a drawer opened.
  // Only the native status bar strip dims (handled in syncNativeStatusBar).
  const visibleTopColor = routeTopColor;
  const isAuthColor = visibleTopColor === AUTH_TOP_COLOR;
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.toggle('app-overlay-chrome', isOverlay);
  document.body?.classList.toggle('app-overlay-chrome', isOverlay);
  document.documentElement.style.colorScheme = 'light';
  document.documentElement.style.setProperty('--app-top-bg', visibleTopColor);
  document.body?.style.setProperty('--app-top-bg', visibleTopColor);
  document.documentElement.style.backgroundColor = visibleTopColor;
  if (document.body) document.body.style.backgroundColor = visibleTopColor;

  // Keep #root in sync with route chrome so auth-like routes (and native
  // cold boot) paint lime end-to-end, while in-app routes restore cream.
  if (isAuthColor) {
    document.documentElement.style.setProperty('--background', '111 95% 92%');
    document.documentElement.classList.add('boot-auth');
  } else if (!isOverlay) {
    document.documentElement.style.removeProperty('--background');
    document.documentElement.classList.remove('boot-auth');
  }

  const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  theme?.setAttribute('content', visibleTopColor);

  const colorScheme = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  colorScheme?.setAttribute('content', 'light');

  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  status?.setAttribute('content', 'default');

  syncNativeStatusBar(visibleTopColor, isOverlay);
};


const applyOverlayAppChrome = () => {
  applyAppChromeColor(OVERLAY_TOP_COLOR, 'black-translucent');
};

const applyRouteAppChrome = () => {
  applyAppChromeColor(getRouteTopColor());
};

export const restoreRouteAppChrome = () => {
  if (activeOverlayCount > 0) {
    applyOverlayAppChrome();
    return;
  }
  applyRouteAppChrome();
};

export const forceRestoreRouteAppChrome = () => {
  applyRouteAppChrome();
};

// While an overlay (Dialog/Sheet/Drawer/AlertDialog) is mounted, make the
// native status bar transparent and keep the route chrome visible underneath
// so the dim backdrop matches the in-app browser sheet look.
export const pushOverlayAppChrome = () => {
  activeOverlayCount += 1;
  applyOverlayAppChrome();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeOverlayCount = Math.max(0, activeOverlayCount - 1);
    if (activeOverlayCount === 0) applyRouteAppChrome();
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

  const reapply = () => restoreRouteAppChrome();

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

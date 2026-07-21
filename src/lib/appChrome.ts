const AUTH_TOP_COLOR = '#DDFED7';
const APP_TOP_COLOR = '#F5F1EB';

let nativeChromeRequest = 0;

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
let edgeToEdgeInitialized = false;

// Cached route color (used only for the native strip's route paint).
let cachedRouteColor: string = APP_TOP_COLOR;

const isNativeBridgeReady = (): boolean => {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return false;
  // Avoid calling StatusBar before the native bridge has registered its plugins.
  return cap.isPluginAvailable?.('StatusBar') ?? true;
};

// Route-color path: debounced to avoid thrash during navigation.
// On native iOS the status bar must stay transparent/edge-to-edge so the
// WebView and drawer backdrop remain "live" behind the notch area. Never paint
// a separate native status-bar background here.
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
        // Keep the native status bar transparent/edge-to-edge. The WebView's
        // iOS contentInset setting keeps content stable without global CSS
        // padding, while the live page/backdrop renders behind the icons.
        if (!edgeToEdgeInitialized) {
          edgeToEdgeInitialized = true;
          void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
        }
        void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      })
      .catch(() => undefined);
  }, 60);
};

export const applyAppChromeColor = (color: string, _statusBarStyle: 'default' | 'black-translucent' = 'default') => {
  // Keep route chrome stable. Overlay dimming belongs to the overlay backdrop,
  // not a second status-bar tint layer.
  const routeTopColor = getRouteTopColor();
  const isAuthColor = routeTopColor === AUTH_TOP_COLOR;

  cachedRouteColor = routeTopColor;




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
};

// Always re-assert transparent edge-to-edge status bar on the native side.
// Native plugins (Camera, Share, Wallet) can cause iOS to silently revert the
// overlay flag when they dismiss. Calling this after a native return keeps the
// notch area live instead of reverting to a solid native strip.
const reassertEdgeToEdgeStatusBar = () => {
  if (!isNativeBridgeReady()) return;
  const requestId = ++nativeChromeRequest;
  void Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')])
    .then(([{ Capacitor }, { StatusBar, Style }]) => {
      if (requestId !== nativeChromeRequest) return;
      if (!Capacitor.isNativePlatform()) return;
      void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    })
    .catch(() => undefined);
};

export const forceRestoreRouteAppChrome = () => {
  // Reset guards so the route write below always re-pushes the native flag,
  // not just the color.
  lastAppliedColor = null;
  edgeToEdgeInitialized = false;
  applyRouteAppChrome();
  reassertEdgeToEdgeStatusBar();
};

// Drawer/Dialog dimming is handled by the actual overlay only. Do not add a
// separate status-bar tint layer: it stacks with the backdrop and makes the
// notch strip darker than the rest of the screen.
export const pushOverlayAppChrome = () => {
  return () => undefined;
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

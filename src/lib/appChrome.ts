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
  // Native status bar is ALWAYS in overlay mode so the page background
  // (cream/lime/drawer dim) shows through it, matching the in-app Safari
  // look. Only the icon `style` changes based on what's underneath.
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
        lastAppliedColor = color;
        lastAppliedOverlay = isOverlay;
        // Always transparent overlay
        void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
        void StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => undefined);
        // When an overlay (dialog/sheet/drawer) is open, its dim backdrop
        // sits above the page, so use Light icons. Otherwise pick icon
        // color based on the underlying route color (light bg → dark icons).
        void StatusBar.setStyle({ style: isOverlay ? Style.Light : Style.Dark }).catch(() => undefined);
      })
      .catch(() => undefined);
  }, 60);
};

export const applyAppChromeColor = (color: string, statusBarStyle: 'default' | 'black-translucent' = 'default') => {
  const isOverlay = statusBarStyle === 'black-translucent';
  const routeTopColor = getRouteTopColor();
  const visibleTopColor = isOverlay ? routeTopColor : color;
  const isAuthColor = visibleTopColor === AUTH_TOP_COLOR;
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.toggle('app-overlay-chrome', isOverlay);
  document.body?.classList.toggle('app-overlay-chrome', isOverlay);
  document.documentElement.style.colorScheme = isOverlay ? 'dark' : 'light';
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
  colorScheme?.setAttribute('content', isOverlay ? 'dark light' : 'light');

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

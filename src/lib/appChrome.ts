const AUTH_TOP_COLOR = '#DDFED7';
const APP_TOP_COLOR = '#F5F1EB';
const OVERLAY_TOP_COLOR = '#000000';

let nativeChromeRequest = 0;
let activeOverlayCount = 0;

const getRouteTopColor = () => {
  const isAuthLike = /^\/(auth|forgot-password|reset-password|verify-email)(\/|$)/.test(window.location.pathname);
  return isAuthLike ? AUTH_TOP_COLOR : APP_TOP_COLOR;
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
  // Debounce + dedupe to stop the boot-time flood of StatusBar calls that
  // can race with the Capacitor bridge before window.Capacitor.triggerEvent exists.
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
        if (isOverlay) {
          void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
          void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
          void StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => undefined);
        } else {
          void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
          void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
          void StatusBar.setBackgroundColor({ color }).catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, 60);
};

export const applyAppChromeColor = (color: string, statusBarStyle: 'default' | 'black-translucent' = 'default') => {
  const isOverlay = statusBarStyle === 'black-translucent';
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.toggle('app-overlay-chrome', isOverlay);
  document.body?.classList.toggle('app-overlay-chrome', isOverlay);
  document.documentElement.style.colorScheme = isOverlay ? 'dark' : 'light';
  document.documentElement.style.setProperty('--app-top-bg', color);
  document.body?.style.setProperty('--app-top-bg', color);
  document.documentElement.style.backgroundColor = color;
  if (document.body) document.body.style.backgroundColor = color;

  const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  theme?.setAttribute('content', color);

  const colorScheme = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
  colorScheme?.setAttribute('content', isOverlay ? 'dark light' : 'light');

  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  status?.setAttribute('content', 'default');

  syncNativeStatusBar(color, isOverlay);
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

// While an overlay (Dialog/Sheet/Drawer/AlertDialog) is mounted, paint the
// status-bar / theme-color black so the dim backdrop visually extends all the
// way to the top of the screen on iOS PWA + Android. Cleanup restores the
// route's normal cream/auth-green chrome.
// Overlays (Dialog/Sheet/Drawer/AlertDialog) should NOT recolor the status bar.
// Keep the route's normal chrome painted underneath the dim scrim.
export const pushOverlayAppChrome = () => {
  return () => undefined;
};

// Web-only visibility re-apply. Native (Capacitor) resume/appStateChange
// listeners are registered ONCE inside AppContent (src/App.tsx) so we don't
// double-register and flood the bridge during boot.
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
};

installResumeListeners();

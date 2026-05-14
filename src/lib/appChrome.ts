const AUTH_TOP_COLOR = '#DDFED7';
const APP_TOP_COLOR = '#F5F1EB';

const getRouteTopColor = () => {
  const isAuthLike = /^\/(auth|forgot-password|reset-password|verify-email)(\/|$)/.test(window.location.pathname);
  return isAuthLike ? AUTH_TOP_COLOR : APP_TOP_COLOR;
};

const syncNativeStatusBar = (color: string) => {
  void Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')])
    .then(([{ Capacitor }, { StatusBar, Style }]) => {
      if (!Capacitor.isNativePlatform()) return;
      // overlay:false + Style.Dark (dark text) so the cream bg actually paints under the status bar
      void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color }).catch(() => undefined);
    })
    .catch(() => undefined);
};

export const applyAppChromeColor = (color: string) => {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'light';
  document.documentElement.style.setProperty('--app-top-bg', color);
  document.body?.style.setProperty('--app-top-bg', color);
  document.documentElement.style.backgroundColor = color;
  if (document.body) document.body.style.backgroundColor = color;

  const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  theme?.setAttribute('content', color);

  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  status?.setAttribute('content', 'default');

  syncNativeStatusBar(color);
};

export const restoreRouteAppChrome = () => {
  applyAppChromeColor(getRouteTopColor());
};

// While an overlay (Dialog/Sheet/Drawer/AlertDialog) is mounted, paint the
// status-bar / theme-color black so the dim backdrop visually extends all the
// way to the top of the screen on iOS PWA + Android. Cleanup restores the
// route's normal cream/auth-green chrome.
const OVERLAY_TOP_COLOR = '#000000';
export const pushOverlayAppChrome = () => {
  const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  theme?.setAttribute('content', OVERLAY_TOP_COLOR);
  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  status?.setAttribute('content', 'black-translucent');
  syncNativeStatusBar(OVERLAY_TOP_COLOR);
  return () => restoreRouteAppChrome();
};

// Re-apply on every foreground / visibility change. iOS resets the native status bar
// when the webview navigates away (e.g. Stripe Connect redirect) and on resume the
// boot config briefly paints a dark bar until our JS re-asserts the cream color.
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

  void import('@capacitor/app')
    .then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) reapply();
      });
      App.addListener('resume', reapply);
    })
    .catch(() => undefined);
};

installResumeListeners();

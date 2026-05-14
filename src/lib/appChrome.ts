const AUTH_TOP_COLOR = '#DDFED7';
const APP_TOP_COLOR = '#F5F1EB';
const OVERLAY_TOP_COLOR = '#141414';

let overlayDepth = 0;
let restoreTimer: number | undefined;

const getRouteTopColor = () => {
  const isAuthLike = /^\/(auth|forgot-password|reset-password|verify-email)(\/|$)/.test(window.location.pathname);
  return isAuthLike ? AUTH_TOP_COLOR : APP_TOP_COLOR;
};

const syncNativeStatusBar = (color: string) => {
  void Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')])
    .then(([{ Capacitor }, { StatusBar, Style }]) => {
      if (!Capacitor.isNativePlatform()) return;
      void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
      void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
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
  if (overlayDepth > 0) {
    applyAppChromeColor(OVERLAY_TOP_COLOR);
    return;
  }

  applyAppChromeColor(getRouteTopColor());
};

export const pushOverlayAppChrome = () => {
  if (restoreTimer !== undefined) {
    window.clearTimeout(restoreTimer);
    restoreTimer = undefined;
  }

  overlayDepth += 1;
  applyAppChromeColor(OVERLAY_TOP_COLOR);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    overlayDepth = Math.max(0, overlayDepth - 1);

    if (overlayDepth === 0) {
      restoreTimer = window.setTimeout(() => {
        restoreTimer = undefined;
        if (overlayDepth === 0) restoreRouteAppChrome();
      }, 0);
    }
  };
};
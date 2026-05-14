const AUTH_TOP_COLOR = '#DDFED7';
const APP_TOP_COLOR = '#F5F1EB';
const ROUTE_CHROME_RESTORE_DELAYS = [50, 150, 300, 700, 1200, 2200];

let restoreTimers: number[] = [];

const getRouteTopColor = () => {
  const isAuthLike = /^\/(auth|forgot-password|reset-password|verify-email)(\/|$)/.test(window.location.pathname);
  return isAuthLike ? AUTH_TOP_COLOR : APP_TOP_COLOR;
};

const syncNativeStatusBar = (color: string) => {
  void Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')])
    .then(([{ Capacitor }, { StatusBar, Style }]) => {
      if (!Capacitor.isNativePlatform()) return;
      void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
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
  restoreTimers.forEach((timer) => window.clearTimeout(timer));
  restoreTimers = [];

  const applyRouteColor = () => applyAppChromeColor(getRouteTopColor());
  applyRouteColor();

  restoreTimers = ROUTE_CHROME_RESTORE_DELAYS.map((delay) => window.setTimeout(applyRouteColor, delay));
};

export const pushOverlayAppChrome = () => {
  restoreRouteAppChrome();
  return restoreRouteAppChrome;
};
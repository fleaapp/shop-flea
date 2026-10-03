/**
 * Subscribe to "the user is back in the app" events.
 *
 * Web `focus`/`visibilitychange` are unreliable inside the iOS/Android
 * WebView, so on native we also listen to Capacitor's `appStateChange`
 * and `resume`. The callback may fire more than once per resume - callers
 * should be idempotent or throttle.
 */
export const onAppResume = (cb: () => void): (() => void) => {
  const onVisibility = () => {
    if (document.visibilityState === 'visible') cb();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', cb);

  const nativeHandles: Array<{ remove: () => Promise<void> | void }> = [];
  let cancelled = false;

  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    void import('@capacitor/app')
      .then(async ({ App }) => {
        const h1 = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) cb();
        });
        const h2 = await App.addListener('resume', cb);
        if (cancelled) {
          void h1.remove();
          void h2.remove();
        } else {
          nativeHandles.push(h1, h2);
        }
      })
      .catch(() => undefined);
  }

  return () => {
    cancelled = true;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', cb);
    nativeHandles.forEach((h) => void h.remove());
  };
};

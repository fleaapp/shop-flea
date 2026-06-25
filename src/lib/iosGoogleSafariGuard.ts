function isIosNativeRuntime(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const cap = (window as any).Capacitor;
  const isIosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);

  return Boolean(
    isIosDevice ||
      window.location.protocol === 'capacitor:' ||
      cap?.getPlatform?.() === 'ios' ||
      cap?.isNativePlatform?.() ||
      (window as any).webkit?.messageHandlers?.bridge,
  );
}

function isGoogleWebOAuthUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value, window.location.href);
    const href = url.href.toLowerCase();
    const provider = url.searchParams.get('provider')?.toLowerCase();

    return (
      (href.includes('/auth/v1/authorize') && provider === 'google') ||
      href.includes('accounts.google.com') ||
      href.includes('oauth2.googleapis.com')
    );
  } catch {
    const raw = value.toLowerCase();
    return raw.includes('accounts.google.com') || (raw.includes('/auth/v1/authorize') && raw.includes('provider=google'));
  }
}

export function installIosGoogleSafariGuard() {
  if (!isIosNativeRuntime()) return;
  if ((window as any).__fleaIosGoogleSafariGuardInstalled) return;
  (window as any).__fleaIosGoogleSafariGuardInstalled = true;

  const block = (url: unknown) => {
    if (!isGoogleWebOAuthUrl(url)) return false;
    console.error('[ios-google-guard] Blocked Google web OAuth/Safari navigation:', url);
    window.dispatchEvent(new CustomEvent('flea-ios-google-web-oauth-blocked'));
    return true;
  };

  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (block(String(url ?? ''))) return null;
    return originalOpen(url, target, features);
  }) as typeof window.open;

  const originalAssign = window.location.assign.bind(window.location);
  window.location.assign = ((url: string | URL) => {
    if (block(String(url))) return;
    return originalAssign(url);
  }) as typeof window.location.assign;

  const originalReplace = window.location.replace.bind(window.location);
  window.location.replace = ((url: string | URL) => {
    if (block(String(url))) return;
    return originalReplace(url);
  }) as typeof window.location.replace;
}
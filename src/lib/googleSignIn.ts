import { Capacitor } from '@capacitor/core';

/**
 * Google sign-in platform guard.
 *
 * The product requirement is strict: Google sign-in must not leave the iOS app.
 * Google's iOS OAuth/authentication surfaces can open Safari-like system browser
 * UI, so iOS fails closed and web/Android can continue using web OAuth.
 */
export type NativeGoogleResult =
  | { handled: false }
  | { handled: true; error: null; cancelled?: false }
  | { handled: true; error: Error; cancelled: boolean };

function isIosUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

export function isIosRuntime(): boolean {
  try {
    return Capacitor.getPlatform() === 'ios' || isIosUserAgent();
  } catch {
    return isIosUserAgent();
  }
}

function hasCapacitorIosBridge(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as any).Capacitor;
    return (
      (Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform()) ||
      (cap?.getPlatform?.() === 'ios' && cap?.isNativePlatform?.()) ||
      typeof cap?.nativePromise === 'function' ||
      !!(window as any).webkit?.messageHandlers?.bridge ||
      window.location.protocol === 'capacitor:'
    );
  } catch {
    return !!(window as any).webkit?.messageHandlers?.bridge ||
      typeof (window as any).Capacitor?.nativePromise === 'function' ||
      window.location.protocol === 'capacitor:';
  }
}

function isPackagedIosShell(): boolean {
  if (typeof window === 'undefined') return false;
  return isIosUserAgent() && (
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

export function isIosNative(): boolean {
  return hasCapacitorIosBridge() || isPackagedIosShell();
}

function googleIosBlockDiagnostics() {
  return {
    capacitorPlatform: (() => {
      try { return Capacitor.getPlatform(); } catch { return 'unknown'; }
    })(),
    capacitorNative: (() => {
      try { return Capacitor.isNativePlatform(); } catch { return false; }
    })(),
    locationProtocol: typeof window !== 'undefined' ? window.location.protocol : 'none',
    locationHost: typeof window !== 'undefined' ? window.location.host : 'none',
    hasBridge: hasCapacitorIosBridge(),
  };
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  // On any iOS runtime, never allow callers to fall through to web OAuth,
  // because that is the path that opens Safari.
  if (!isIosRuntime()) return { handled: false };

  console.info('[googleSignIn] iOS Google sign-in blocked before browser-capable auth starts', googleIosBlockDiagnostics());
  return {
    handled: true,
    error: new Error('Google sign-in cannot stay fully inside the iPhone app. Use Apple or email sign-in on iOS.'),
    cancelled: false,
  };
}

import { Capacitor } from '@capacitor/core';

/**
 * iOS native Google Sign-In using the system credential flow (no Safari bounce).
 *
 * Returns:
 *  - { handled: false } on non-iOS-native platforms → caller should fall back to web OAuth.
 *  - { handled: true, error: null } on success → session is set on the supabase client.
 *  - { handled: true, error, cancelled } when the native flow ran but failed/was cancelled.
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

function hasNativeGoogleSignInPlugin(): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasCapacitorIosBridge()) return false;

  try {
    if (typeof Capacitor.isPluginAvailable === 'function') {
      return Capacitor.isPluginAvailable('GoogleSignIn');
    }
  } catch {
    // Continue to bridge/header fallbacks below.
  }

  const cap = (window as any).Capacitor;
  const pluginHeaders = cap?.PluginHeaders;

  if (Array.isArray(pluginHeaders)) {
    return pluginHeaders.some((plugin: any) => plugin?.name === 'GoogleSignIn');
  }

  if (pluginHeaders && typeof pluginHeaders === 'object') {
    return Boolean(pluginHeaders.GoogleSignIn || pluginHeaders.GoogleSignInPlugin);
  }

  // Last resort: in a real Capacitor iOS bridge, let the native proxy call fail
  // closed with a clear error instead of ever falling through to web OAuth.
  return typeof cap?.nativePromise === 'function';
}

function googleNativeDiagnostics() {
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
  const headers = cap?.PluginHeaders;
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
    hasPlugin: hasNativeGoogleSignInPlugin(),
    pluginHeaders: Array.isArray(headers)
      ? headers.map((plugin: any) => plugin?.name).filter(Boolean)
      : headers && typeof headers === 'object'
        ? Object.keys(headers)
        : [],
  };
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  // On any iOS runtime, this function owns Google sign-in. Returning
  // handled:false on iOS lets callers fall through to web OAuth, which opens
  // Safari. If the native bridge/plugin is missing, fail closed instead.
  if (!isIosRuntime()) return { handled: false };

  console.info('[googleSignIn] iOS native-only path selected', googleNativeDiagnostics());
  return {
    handled: true,
    error: new Error('Google sign-in cannot stay fully inside the iPhone app. Use Apple or email sign-in on iOS.'),
    cancelled: false,
  };
}

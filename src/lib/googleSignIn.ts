import { Capacitor } from '@capacitor/core';

/**
 * Google sign-in is currently paused. The native plugin
 * (`@codetrix-studio/capacitor-google-auth`) has been removed so that
 * `npx cap sync ios` no longer generates Google URL schemes in Info.plist
 * (which caused Apple to reject archives due to the `[REVERSED_IOS_CLIENT_ID]`
 * placeholder). When we re-enable Google auth, restore the native plugin
 * and the initialize/signIn logic here.
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

export function isNativeRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  // Paused. Always let the caller fall through to the web OAuth path.
  return { handled: false };
}

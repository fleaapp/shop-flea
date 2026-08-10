import { Capacitor } from '@capacitor/core';

/**
 * Google sign-in deliberately uses the in-app browser flow
 * (SFSafariViewController on iOS / Chrome Custom Tab on Android) rather than a
 * native Google plugin. Google allows SFSafariViewController and blocks only
 * embedded WKWebViews, so this keeps the user inside the app while avoiding the
 * `@codetrix-studio/capacitor-google-auth` plugin — that plugin generated a
 * `[REVERSED_IOS_CLIENT_ID]` placeholder URL scheme in Info.plist on
 * `npx cap sync ios`, which caused an App Store archive rejection.
 *
 * The OAuth flow is handled by Lovable Cloud's managed OAuth broker, using the
 * project's own Google Cloud OAuth credentials (BYOK). This shows Flea branding
 * on the Google consent screen and routes the callback through the universal
 * link origin (`https://app.finditonflea.com`) on native so the session is
 * handed back to the app.
 *
 * `nativeGoogleSignIn` therefore always returns `{ handled: false }` so every
 * platform falls through to the managed OAuth path in `Auth.tsx`.
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
  // Always let the caller fall through to the in-app browser OAuth path.
  return { handled: false };
}

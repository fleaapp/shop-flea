import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '@/lib/supabase';

/**
 * Native Google sign-in.
 *
 * Uses `@codetrix-studio/capacitor-google-auth` on iOS/Android so the account
 * picker opens as a native sheet on top of the app. No SFSafariViewController,
 * no Safari bounce, no universal-link round-trip. The returned Google ID token
 * is handed to Supabase via `signInWithIdToken` in-process, so the user never
 * leaves the app.
 *
 * On web (PWA / desktop preview) we return { handled: false } so the caller
 * falls back to standard Supabase `signInWithOAuth`.
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

// Cache init so we don't call GoogleAuth.initialize() repeatedly.
let googleAuthInitialized = false;
async function ensureInitialized() {
  if (googleAuthInitialized) return;
  try {
    await GoogleAuth.initialize({
      // clientId / iosClientId / serverClientId are picked up from
      // capacitor.config.ts (iOS) and strings.xml (Android). We still call
      // initialize() to trigger the JS shim on web platforms; it's a no-op
      // on native when the plist / config already carries the client ids.
      scopes: ['profile', 'email'],
      grantOfflineAccess: false,
    });
  } catch (err) {
    // Non-fatal: on native the plugin auto-initializes from Info.plist.
    console.warn('[googleSignIn] GoogleAuth.initialize warning', err);
  }
  googleAuthInitialized = true;
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  // Only run the native flow when a Capacitor bridge is present. In the
  // browser we let the caller do the standard web OAuth redirect.
  if (!isNativeRuntime()) return { handled: false };

  try {
    await ensureInitialized();
    const result: any = await GoogleAuth.signIn();
    const idToken: string | undefined =
      result?.authentication?.idToken || result?.idToken;

    if (!idToken) {
      return {
        handled: true,
        error: new Error('Google did not return an ID token. Please try again.'),
        cancelled: false,
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      return { handled: true, error: new Error(error.message), cancelled: false };
    }

    return { handled: true, error: null };
  } catch (err: any) {
    const message: string = err?.message || err?.error || String(err ?? '');
    const cancelled =
      /cancel/i.test(message) ||
      /-5\b/.test(message) || // SIGN_IN_CANCELLED
      /12501/.test(message); // Android SIGN_IN_CANCELLED
    return {
      handled: true,
      error: new Error(message || 'Google sign-in failed.'),
      cancelled,
    };
  }
}

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/config/googleAuth';

/**
 * Native Google sign-in.
 *
 * On iOS and Android this opens Google's own system account sheet (the same
 * one used by Gmail/YouTube) via the Google Sign-In SDK — one tap, no browser,
 * no redirect, no typing. The SDK returns an ID token minted for the web
 * client id, which is exchanged for a session directly with the backend, so
 * there is no callback page and nothing to poll.
 *
 * Branding comes from the Google Cloud consent screen configured for these
 * credentials (Flea), never from a third-party broker.
 *
 * If the client ids are not configured, or the native sheet is unavailable,
 * this returns `{ handled: false }` and the caller falls back to the in-app
 * browser OAuth flow so sign-in always works.
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

/** True when the native picker is possible on this device + configuration. */
export function nativeGoogleAvailable(): boolean {
  if (!isNativeRuntime()) return false;
  if (!GOOGLE_WEB_CLIENT_ID) return false;
  if (Capacitor.getPlatform() === 'ios' && !GOOGLE_IOS_CLIENT_ID) return false;
  return true;
}

let initialised = false;
let inFlight = false;

const isCancellation = (message: string): boolean =>
  /cancel|dismiss|user closed|-5\b|12501/i.test(message);

/**
 * The Google SDK always mints its own nonce and stamps it into the ID token.
 * The backend rejects the exchange unless the very same value is sent along
 * with the token, so we read the claim straight out of the token rather than
 * guessing whether the platform hashed anything.
 */
const nonceFromIdToken = (token: string): string | undefined => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { nonce?: string };
    return typeof claims.nonce === 'string' && claims.nonce ? claims.nonce : undefined;
  } catch {
    return undefined;
  }
};

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  if (!nativeGoogleAvailable()) return { handled: false };
  if (inFlight) return { handled: true, error: new Error('Sign in already in progress'), cancelled: true };

  let SocialLogin: typeof import('@capgo/capacitor-social-login').SocialLogin;
  try {
    ({ SocialLogin } = await import('@capgo/capacitor-social-login'));
  } catch {
    return { handled: false };
  }

  inFlight = true;
  try {
    if (!initialised) {
      await SocialLogin.initialize({
        google: {
          iOSClientId: GOOGLE_IOS_CLIENT_ID || undefined,
          // The audience the backend trusts.
          iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
          webClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
        },
      });
      initialised = true;
    }

    // Drop any account the SDK is still holding on to, so the picker always
    // opens and a different Google account can be chosen.
    try {
      await SocialLogin.logout({ provider: 'google' });
    } catch {
      /* no cached session — fine */
    }

    const login = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'], forcePrompt: true },
    });

    const result = (login as any)?.result ?? {};
    const idToken: string | undefined =
      result?.idToken ?? result?.authentication?.idToken ?? result?.id_token;

    if (!idToken) {
      // Nothing usable came back — let the browser flow take over rather than
      // dead-ending the user.
      return { handled: false };
    }

    const nonce = nonceFromIdToken(idToken);

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      ...(nonce ? { nonce } : {}),
    });
    if (error) return { handled: true, error, cancelled: false };

    return { handled: true, error: null };
  } catch (err: any) {
    const message: string = err?.message || String(err);
    if (isCancellation(message)) {
      return { handled: true, error: new Error('Sign in was cancelled'), cancelled: true };
    }
    // A configuration/runtime problem: reset so the next tap re-initialises
    // cleanly, and fall back to the browser flow.
    initialised = false;
    console.warn('Native Google sign-in unavailable, falling back:', message);
    return { handled: false };
  } finally {
    inFlight = false;
  }
}


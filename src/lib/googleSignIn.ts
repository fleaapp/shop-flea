import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from '@/lib/supabase';

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

export function isIosNative(): boolean {
  try {
    const capacitorIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
    const bridgeIos = typeof window !== 'undefined'
      && !!(window as any).webkit?.messageHandlers?.bridge;
    return capacitorIos || bridgeIos;
  } catch {
    return typeof window !== 'undefined'
      && !!(window as any).webkit?.messageHandlers?.bridge;
  }
}

let initialized = false;
async function ensureInit() {
  if (initialized) return;
  try {
    // Use the Capacitor 8-compatible native Google SDK wrapper. Its iOS side
    // is patched to read GIDClientID from Info.plist so Google stays native.
    await SocialLogin.initialize({
      google: {
        mode: 'online',
      },
    });
    initialized = true;
  } catch (e) {
    console.warn('[googleSignIn] initialize() warning:', e);
    initialized = true;
  }
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  if (!isIosNative()) return { handled: false };

  try {
    await ensureInit();
    const res = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
        forcePrompt: true,
      },
    });
    const idToken = res?.provider === 'google' && res.result.responseType === 'online'
      ? res.result.idToken
      : null;
    if (!idToken) {
      return {
        handled: true,
        error: new Error('Google did not return an identity token.'),
        cancelled: false,
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('[googleSignIn] signInWithIdToken error:', error);
      return { handled: true, error, cancelled: false };
    }
    return { handled: true, error: null };
  } catch (err: any) {
    const message = String(err?.message ?? err ?? '');
    const cancelled =
      /cancel/i.test(message) ||
      err?.code === 'USER_CANCELLED' ||
      err?.code === '12501' ||
      err?.code === 12501 ||
      err?.code === '-5';
    return {
      handled: true,
      error: err instanceof Error ? err : new Error(message || 'Google sign-in failed'),
      cancelled,
    };
  }
}

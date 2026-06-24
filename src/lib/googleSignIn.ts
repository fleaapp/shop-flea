import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
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
    // The plugin reads the iOS client id from capacitor.config.ts or
    // ios/App/App/GoogleService-Info.plist. It does not read GIDClientID alone.
    await GoogleAuth.initialize({
      scopes: ['email', 'profile', 'openid'],
      grantOfflineAccess: false,
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
    const res = await GoogleAuth.signIn();
    const idToken = res?.authentication?.idToken;
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

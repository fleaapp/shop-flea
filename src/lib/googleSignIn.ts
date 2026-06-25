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

function isIosUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
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

function randomNonce(length = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let initialized = false;
async function ensureInit() {
  if (initialized) return;
  // Use the Capacitor 8-compatible native Google SDK wrapper. Its iOS side
  // is patched to read GIDClientID from Info.plist so Google stays native.
  // Do not swallow init failures: falling back to web OAuth is what opened Safari.
  await SocialLogin.initialize({
    google: {
      mode: 'online',
    },
  });
  initialized = true;
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  if (!isIosNative()) return { handled: false };

  if (!hasCapacitorIosBridge()) {
    return {
      handled: true,
      error: new Error('Native Google sign-in is unavailable in this iOS build.'),
      cancelled: false,
    };
  }

  try {
    const rawNonce = randomNonce();
    const hashedNonce = await sha256Hex(rawNonce);

    await ensureInit();
    const res = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
        forcePrompt: true,
        nonce: hashedNonce,
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
      nonce: rawNonce,
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

import { Capacitor } from '@capacitor/core';
import { SignInWithApple, type SignInWithAppleOptions } from '@capacitor-community/apple-sign-in';
import { supabase } from '@/lib/supabase';

/**
 * iOS native Apple Sign-In using the system sheet (no Safari bounce).
 * Returns:
 *  - { handled: false } on non-iOS-native platforms → caller should fall back to web OAuth.
 *  - { handled: true, error: null } on success → session is set on supabase client.
 *  - { handled: true, error, cancelled } when the native flow ran but failed/was cancelled.
 */
export type NativeAppleResult =
  | { handled: false }
  | { handled: true; error: null; cancelled?: false }
  | { handled: true; error: Error; cancelled: boolean };

export function isIosNative(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
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

export async function nativeAppleSignIn(): Promise<NativeAppleResult> {
  if (!isIosNative()) return { handled: false };

  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  const options: SignInWithAppleOptions = {
    clientId: 'com.finditonflea.app',
    redirectURI: '',
    scopes: 'email name',
    state: randomNonce(16),
    nonce: hashedNonce,
  };

  try {
    const res = await SignInWithApple.authorize(options);
    const idToken = res?.response?.identityToken;
    if (!idToken) {
      return { handled: true, error: new Error('Apple did not return an identity token.'), cancelled: false };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
      nonce: rawNonce,
    });

    if (error) return { handled: true, error, cancelled: false };
    return { handled: true, error: null };
  } catch (err: any) {
    // Apple cancellation codes: 1000 (unknown), 1001 (canceled), 1002 (invalid response),
    // 1003 (not handled), 1004 (failed). Treat 1001 as a silent cancel.
    const code = err?.code ?? err?.errorCode;
    const cancelled = code === '1001' || code === 1001 || /cancel/i.test(String(err?.message ?? ''));
    return {
      handled: true,
      error: err instanceof Error ? err : new Error(String(err?.message ?? err)),
      cancelled,
    };
  }
}

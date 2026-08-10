import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

/**
 * In-app OAuth sign-in.
 *
 * Web: opens the Lovable Cloud OAuth broker in a small popup window using the
 * `web_message` response mode, so the user picks their Google account in a
 * normal popup and lands straight back on the app (no full-page redirect).
 *
 * Native (iOS/Android): opens the same broker URL in an in-app browser sheet
 * (SFSafariViewController / Chrome Custom Tab). The broker redirects back to
 * the universal-link origin, `appUrlOpen` in App.tsx closes the sheet and
 * routes to /auth/callback which applies the session.
 */

const BROKER_PATH = '/~oauth/initiate';
const NATIVE_ORIGIN = 'https://app.finditonflea.com';
const MESSAGE_TYPE = 'authorization_response';
const ALLOWED_MESSAGE_ORIGINS = ['https://oauth.lovable.app', 'https://lovable.dev'];
const POPUP_CHECK_INTERVAL_MS = 500;

export type OAuthPopupResult =
  | { error: null; redirected?: boolean; cancelled?: false }
  | { error: Error; cancelled?: boolean };

const randomState = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const buildBrokerUrl = (
  origin: string,
  provider: string,
  redirectUri: string,
  state: string,
  extraParams: Record<string, string>,
  webMessage: boolean,
) => {
  const params = new URLSearchParams({
    ...extraParams,
    provider,
    redirect_uri: redirectUri,
    state,
  });
  if (webMessage) params.set('response_mode', 'web_message');
  return `${origin}${BROKER_PATH}?${params.toString()}`;
};

export async function signInWithOAuthPopup(
  provider: 'google' | 'apple',
  extraParams: Record<string, string> = {},
): Promise<OAuthPopupResult> {
  const state = randomState();

  // ---- Native: in-app browser sheet, session applied via /auth/callback ----
  if (isNative()) {
    const url = buildBrokerUrl(NATIVE_ORIGIN, provider, NATIVE_ORIGIN, state, extraParams, false);
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return { error: null, redirected: true };
    } catch (err) {
      // If the in-app browser is unavailable, fall back to a full redirect so
      // sign-in still works rather than failing outright.
      window.location.href = url;
      return { error: null, redirected: true };
    }
  }

  // ---- Web: popup window with web_message response ----
  const origin = window.location.origin;
  const url = buildBrokerUrl(origin, provider, origin, state, extraParams, true);

  let resolveMessage: (data: any) => void = () => {};
  const messagePromise = new Promise<any>((resolve) => {
    resolveMessage = resolve;
  });
  const onMessage = (event: MessageEvent) => {
    if (![...ALLOWED_MESSAGE_ORIGINS, origin].includes(event.origin)) return;
    const data: any = event.data;
    if (!data || typeof data !== 'object' || data.type !== MESSAGE_TYPE) return;
    resolveMessage(data.response);
  };
  window.addEventListener('message', onMessage);

  const width = Math.min(480, Math.max(360, window.outerWidth * 0.5));
  const height = Math.min(720, Math.max(560, window.outerHeight * 0.8));
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(url, 'flea-oauth', `width=${width},height=${height},left=${left},top=${top}`);

  if (!popup) {
    window.removeEventListener('message', onMessage);
    // Popup blocked (or an embedded webview) — fall back to a full redirect.
    window.location.href = buildBrokerUrl(origin, provider, origin, state, extraParams, false);
    return { error: null, redirected: true };
  }

  let interval: ReturnType<typeof setInterval> | undefined;
  const closedPromise = new Promise<never>((_, reject) => {
    interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        const err = new Error('Sign in was cancelled');
        (err as any).cancelled = true;
        reject(err);
      }
    }, POPUP_CHECK_INTERVAL_MS);
  });

  try {
    const data = await Promise.race([messagePromise, closedPromise]);

    if (data?.state !== state) return { error: new Error('State is invalid') };
    if (data?.error) return { error: new Error(data.error_description ?? 'Sign in failed') };
    if (!data?.access_token || !data?.refresh_token) return { error: new Error('No tokens received') };

    const { error } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (error) return { error };
    return { error: null };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)), cancelled: !!err?.cancelled };
  } finally {
    if (interval) clearInterval(interval);
    window.removeEventListener('message', onMessage);
    try {
      popup.close();
    } catch {
      /* noop */
    }
  }
}

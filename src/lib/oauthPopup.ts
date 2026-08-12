import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { NATIVE_OAUTH_BOUNCE_URL } from '@/lib/authRedirects';


/**
 * In-app OAuth sign-in.
 *
 * The authorize URL is built by the app's own auth endpoint (Supabase auth
 * domain) rather than a third-party broker, so no other brand ever appears
 * in the address bar of the popup / in-app browser sheet.
 *
 * Web: opens the authorize URL in a small popup. The popup lands back on
 * `/auth/callback?opener=1`, applies the session and messages the opener.
 *
 * Native (iOS/Android): opens the same URL in an in-app browser sheet
 * (SFSafariViewController / Chrome Custom Tab). The provider redirects back to
 * the app's custom URL scheme, `appUrlOpen` in App.tsx closes the sheet and
 * routes to /auth/callback which applies the session.
 */


const NATIVE_SHEET_TIMEOUT_MS = 5 * 60 * 1000;
/** How long we keep waiting for the session after the in-app sheet closes. */
const NATIVE_SESSION_GRACE_MS = 20000;
export const OAUTH_PENDING_KEY = 'flea_oauth_pending';
export const OAUTH_COMPLETE_MESSAGE = 'flea-oauth-complete';
const POPUP_CHECK_INTERVAL_MS = 500;


export type OAuthPopupResult =
  | { error: null; redirected?: boolean; cancelled?: false }
  | { error: Error; cancelled?: boolean };

const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const buildAuthorizeUrl = async (
  provider: 'google' | 'apple',
  redirectTo: string,
  extraParams: Record<string, string>,
): Promise<{ url?: string; error?: Error }> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: extraParams,
    },
  });
  if (error) return { error };
  if (!data?.url) return { error: new Error('Could not start sign in') };
  return { url: data.url };
};

export async function signInWithOAuthPopup(
  provider: 'google' | 'apple',
  extraParams: Record<string, string> = {},
): Promise<OAuthPopupResult> {
  // ---- Native: in-app browser sheet, session applied via /auth/callback ----
  if (isNative()) {
    // Returns to the https callback page, which immediately bounces to the
    // app's custom URL scheme. iOS ignores universal links reached through a
    // server redirect, so an https-only return keeps the user in the sheet.
    const { url, error } = await buildAuthorizeUrl(
      provider,
      NATIVE_OAUTH_BOUNCE_URL,
      extraParams,
    );
    if (error || !url) return { error: error ?? new Error('Could not start sign in') };

    // Durable marker: the app may be backgrounded / re-mounted while the
    // provider sheet is open. Anything that renders the auth screen can use
    // this to keep showing the branded waiting state instead of a dead end.
    try { sessionStorage.setItem(OAUTH_PENDING_KEY, provider); } catch { /* noop */ }
    const clearPending = () => {
      try { sessionStorage.removeItem(OAUTH_PENDING_KEY); } catch { /* noop */ }
    };

    try {
      const { Browser } = await import('@capacitor/browser');

      // Resolves as soon as a session exists — whether it was applied by the
      // deep-link callback, a token refresh, or was already there.
      const sessionArrived = new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          try { sub?.data.subscription.unsubscribe(); } catch { /* noop */ }
          clearInterval(poll);
          resolve(value);
        };
        const sub = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) finish(true);
        });
        // Belt and braces: some native returns apply the session without
        // emitting an event in this webview instance.
        const poll = setInterval(() => {
          void supabase.auth.getSession().then(({ data }) => {
            if (data.session) finish(true);
          });
        }, 400);
        setTimeout(() => finish(false), NATIVE_SHEET_TIMEOUT_MS);
      });

      // Fires when the sheet closes — by the user, or by our own deep-link
      // handler after a successful return.
      const sheetClosed = new Promise<'closed'>((resolve) => {
        let handle: { remove: () => void } | undefined;
        Browser.addListener('browserFinished', () => {
          try { handle?.remove(); } catch { /* noop */ }
          resolve('closed');
        })
          .then((listener) => { handle = listener; })
          .catch(() => { /* listener unsupported */ });
      });

      await Browser.open({ url, presentationStyle: 'popover' });

      const first = await Promise.race([
        sessionArrived.then((ok) => (ok ? 'session' : 'timeout') as const),
        sheetClosed,
      ]);

      if (first === 'session') {
        clearPending();
        try { await Browser.close(); } catch { /* noop */ }
        return { error: null };
      }

      if (first === 'timeout') {
        clearPending();
        return { error: new Error('Sign in was not completed'), cancelled: false };
      }

      // Sheet closed. It may have been closed by the deep-link handler a beat
      // before the session lands, so keep waiting rather than declaring
      // failure immediately.
      const graced = await Promise.race([
        sessionArrived,
        new Promise<boolean>((r) => setTimeout(() => r(false), NATIVE_SESSION_GRACE_MS)),
      ]);

      clearPending();
      if (graced) return { error: null };

      // No session after the sheet closed: treat as a user cancellation so the
      // auth screen simply returns to normal without a scary error.
      const cancelledErr = new Error('Sign in was cancelled');
      return { error: cancelledErr, cancelled: true };
    } catch {
      clearPending();
      // If the in-app browser is unavailable, fall back to a full redirect so
      // sign-in still works rather than failing outright.
      window.location.href = url;
      return { error: null, redirected: true };
    }
  }


  // ---- Web: popup window that returns via /auth/callback ----
  const origin = window.location.origin;
  const { url, error: urlError } = await buildAuthorizeUrl(
    provider,
    `${origin}/auth/callback?opener=1`,
    extraParams,
  );
  if (urlError || !url) return { error: urlError ?? new Error('Could not start sign in') };

  let resolveMessage: () => void = () => {};
  const messagePromise = new Promise<void>((resolve) => {
    resolveMessage = resolve;
  });
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    const data: any = event.data;
    if (!data || typeof data !== 'object' || data.type !== OAUTH_COMPLETE_MESSAGE) return;
    resolveMessage();
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
    const { url: redirectUrl } = await buildAuthorizeUrl(provider, `${origin}/auth/callback`, extraParams);
    window.location.href = redirectUrl ?? url;
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
    await Promise.race([messagePromise, closedPromise]);

    // The popup shares this origin's storage, so the session is already
    // persisted — just pull it into this client instance.
    const { data, error } = await supabase.auth.getSession();
    if (error) return { error };
    if (!data.session) return { error: new Error('No session received') };
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

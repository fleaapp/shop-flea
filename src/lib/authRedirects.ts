import { supabase } from '@/lib/supabase';

export const AUTH_LINK_BASE_URL = 'https://app.finditonflea.com';
export const AUTH_CALLBACK_PATH = '/auth/callback';
// Custom URL scheme registered in Info.plist. iOS honours this from a page
// navigation inside the OAuth sheet (unlike universal links, which iOS ignores
// when they are reached through a server redirect).
export const NATIVE_APP_SCHEME = 'com.finditonflea.app';
export const NATIVE_OAUTH_REDIRECT_URL = `${NATIVE_APP_SCHEME}:/${AUTH_CALLBACK_PATH}`;
// Native sign-in returns here (an already-allowed https URL); the callback page
// immediately bounces to the app scheme above, carrying the OAuth params.
export const NATIVE_OAUTH_BOUNCE_URL = `${AUTH_LINK_BASE_URL}${AUTH_CALLBACK_PATH}?native=1`;


export const getSignupRedirectUrl = () => `${AUTH_LINK_BASE_URL}${AUTH_CALLBACK_PATH}`;
export const getPasswordResetRedirectUrl = () => `${AUTH_LINK_BASE_URL}/reset-password`;

export const getRouteFromNativeAuthUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    const isAppScheme = parsed.protocol === `${NATIVE_APP_SCHEME}:`;
    if (!isAppScheme && parsed.host !== 'app.finditonflea.com') return null;

    // OAuth broker returns tokens on the app origin (any path). Always route
    // those to /auth/callback so the session is applied instead of dropping
    // the user on the home screen with tokens still in the URL.
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const hasTokens =
      !!parsed.searchParams.get('code') ||
      !!parsed.searchParams.get('access_token') ||
      !!hashParams.get('access_token');

    if (isAppScheme) {
      // Custom-scheme URLs have no meaningful host/path guarantees; always
      // hand them to the callback route so the session is applied.
      return `${AUTH_CALLBACK_PATH}${parsed.search}${parsed.hash}`;
    }

    if (hasTokens && parsed.pathname !== AUTH_CALLBACK_PATH) {
      return `${AUTH_CALLBACK_PATH}${parsed.search}${parsed.hash}`;
    }

    return `${parsed.pathname || '/'}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};


export const completeAuthSessionFromUrl = async () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = searchParams.get('code');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }

  const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }

  return supabase.auth.getSession();
};
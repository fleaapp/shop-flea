import { supabase } from '@/lib/supabase';

export const AUTH_LINK_BASE_URL = 'https://app.finditonflea.com';
export const AUTH_CALLBACK_PATH = '/auth/callback';

export const getSignupRedirectUrl = () => `${AUTH_LINK_BASE_URL}${AUTH_CALLBACK_PATH}`;
export const getPasswordResetRedirectUrl = () => `${AUTH_LINK_BASE_URL}/reset-password`;

export const getRouteFromNativeAuthUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    if (parsed.host !== 'app.finditonflea.com') return null;

    // OAuth broker returns tokens on the app origin (any path). Always route
    // those to /auth/callback so the session is applied instead of dropping
    // the user on the home screen with tokens still in the URL.
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const hasTokens =
      !!parsed.searchParams.get('code') ||
      !!parsed.searchParams.get('access_token') ||
      !!hashParams.get('access_token');

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
import { supabase } from '@/lib/supabase';

export const AUTH_LINK_BASE_URL = 'https://app.finditonflea.com';
export const AUTH_CALLBACK_PATH = '/auth/callback';

export const getSignupRedirectUrl = () => `${AUTH_LINK_BASE_URL}${AUTH_CALLBACK_PATH}`;
export const getPasswordResetRedirectUrl = () => `${AUTH_LINK_BASE_URL}/reset-password`;

export const getRouteFromNativeAuthUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    if (parsed.host !== 'app.finditonflea.com') return null;

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
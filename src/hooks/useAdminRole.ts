import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const CLOUD_FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-check-role`;
const CLOUD_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const HARDCODED_ADMIN_EMAILS = ['sarahhearn02@gmail.com'];
const HARDCODED_ADMIN_USERNAMES = ['sarahhearn2'];

const isHardcodedAdmin = (email?: string | null, username?: string | null) => {
  const e = (email || '').trim().toLowerCase();
  const u = (username || '').trim().toLowerCase().replace(/^@/, '');
  return HARDCODED_ADMIN_EMAILS.includes(e) || HARDCODED_ADMIN_USERNAMES.includes(u);
};

export function useAdminRole() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const hardcoded = isHardcodedAdmin(user?.email, (profile as any)?.username);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(hardcoded ? true : null);
  const [loading, setLoading] = useState(!hardcoded);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setIsAdmin(null);
      setLoading(authLoading);
      return;
    }

    if (isHardcodedAdmin(user.email, (profile as any)?.username)) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    async function check() {
      setIsAdmin(null);
      setLoading(true);

      try {
        let token = session?.access_token;
        if (!token) {
          const { data } = await supabase.auth.getSession();
          token = data.session?.access_token;
        }

        const res = await fetch(CLOUD_FN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: CLOUD_ANON,
            Authorization: token ? `Bearer ${token}` : `Bearer ${CLOUD_ANON}`,
          },
          body: JSON.stringify({}),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        setIsAdmin(Boolean(json?.isAdmin));
      } catch (e) {
        console.error('admin check error', e);
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user, session, profile, authLoading]);

  return { isAdmin: isAdmin === true, loading };
}


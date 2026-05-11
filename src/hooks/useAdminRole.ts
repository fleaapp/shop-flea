import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const CLOUD_FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-check-role`;
const CLOUD_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function useAdminRole() {
  const { user, session } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      try {
        // Get a fresh access token from the external auth session
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
        console.log('[admin-check-role] response', json);
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
  }, [user, session]);

  return { isAdmin: !!isAdmin, loading };
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export function useAdminRole() {
  const { user } = useAuth();
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
        const { data, error } = await supabase.rpc('has_role' as any, {
          _user_id: user.id,
          _role: 'admin',
        });
        if (cancelled) return;
        if (error) {
          console.error('has_role check failed', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(Boolean(data));
        }
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
  }, [user]);

  return { isAdmin: !!isAdmin, loading };
}

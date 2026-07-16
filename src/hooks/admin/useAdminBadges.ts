import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callAdminData } from './useAdminData';

export type AdminBadges = {
  support: number;
  reports: number;
  bans: number;
  suggestions: number;
  waitlist: number;
  contact: number;
  transactions: number;
  refunds: number;
  listings: number;
  users: number;
  brands: number;
};

const EMPTY: AdminBadges = {
  support: 0, reports: 0, bans: 0, suggestions: 0, waitlist: 0, contact: 0,
  transactions: 0, refunds: 0, listings: 0, users: 0, brands: 0,
};

export function useAdminBadges() {
  const [badges, setBadges] = useState<AdminBadges>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await callAdminData<AdminBadges>('getBadges');
      setBadges({ ...EMPTY, ...data });
    } catch (e) {
      console.error('badges fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const tables = ['chat_messages', 'reports', 'orders', 'listings', 'contact_submissions', 'waitlist', 'profiles', 'brands', 'notifications'];
    const channels = tables.map((t) =>
      supabase
        .channel(`admin-badges-${t}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, () => refresh())
        .subscribe()
    );
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return { badges, loading, refresh };
}

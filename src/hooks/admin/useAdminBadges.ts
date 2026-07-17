import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callAdminData } from './useAdminData';
import { fetchErrorCount24h } from './useAdminErrorLogs';

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
  errorLogs: number;
};

const EMPTY: AdminBadges = {
  support: 0, reports: 0, bans: 0, suggestions: 0, waitlist: 0, contact: 0,
  transactions: 0, refunds: 0, listings: 0, users: 0, brands: 0, errorLogs: 0,
};

export function useAdminBadges() {
  const [badges, setBadges] = useState<AdminBadges>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const brandsSince = typeof window !== 'undefined' ? window.localStorage.getItem('admin_brands_last_seen') : null;
      const data = await callAdminData<AdminBadges>('getBadges', brandsSince ? { brandsSince } : {});
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
    // Unique suffix prevents supabase.channel() from returning an already-subscribed
    // instance on remount, which would throw "cannot add postgres_changes callbacks after subscribe()".
    const uniq = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const channels = tables.map((t) => {
      const ch = supabase.channel(`admin-badges-${t}-${uniq}`);
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: t }, () => refresh());
      ch.subscribe();
      return ch;
    });
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return { badges, loading, refresh };
}

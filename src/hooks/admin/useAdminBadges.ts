import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callAdminData } from './useAdminData';
import { fetchErrorCount24h } from './useAdminErrorLogs';
import { getAllAdminLastSeen } from '@/lib/adminLastSeen';

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

let cachedBadges: AdminBadges = EMPTY;
let hasCachedBadges = false;

export const getAdminBadgeTotal = (badges: AdminBadges) =>
  (badges.support || 0) +
  (badges.reports || 0) +
  (badges.bans || 0) +
  (badges.suggestions || 0) +
  (badges.waitlist || 0) +
  (badges.contact || 0) +
  (badges.transactions || 0) +
  (badges.refunds || 0) +
  (badges.listings || 0) +
  (badges.users || 0) +
  (badges.brands || 0) +
  (badges.errorLogs || 0);

export const formatAdminBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));

export function useAdminBadges(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const [badges, setBadges] = useState<AdminBadges>(() => cachedBadges);
  const [loading, setLoading] = useState(() => enabled && !hasCachedBadges);
  // Monotonic request id — late responses can't overwrite fresher state.
  const reqIdRef = useRef(0);
  // Trailing debounce timer.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runRefresh = useCallback(async () => {
    if (!enabled) return;
    const myId = ++reqIdRef.current;
    try {
      const lastSeen = getAllAdminLastSeen();
      const payload: Record<string, string> = {};
      if (lastSeen.users) payload.usersSince = lastSeen.users;
      if (lastSeen.listings) payload.listingsSince = lastSeen.listings;
      if (lastSeen.refunds) payload.refundsSince = lastSeen.refunds;
      if (lastSeen.transactions) payload.transactionsSince = lastSeen.transactions;
      if (lastSeen.contact) payload.contactSince = lastSeen.contact;
      if (lastSeen.waitlist) payload.waitlistSince = lastSeen.waitlist;
      if (lastSeen.brands) payload.brandsSince = lastSeen.brands;

      const [data, errorLogs] = await Promise.all([
        callAdminData<Omit<AdminBadges, 'errorLogs'>>('getBadges', payload),
        fetchErrorCount24h(lastSeen.error_logs).catch(() => 0),
      ]);
      // Drop stale responses.
      if (myId !== reqIdRef.current) return;
      const nextBadges = { ...EMPTY, ...data, errorLogs };
      cachedBadges = nextBadges;
      hasCachedBadges = true;
      setBadges(nextBadges);
    } catch (e) {
      console.error('badges fetch failed', e);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [enabled]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void runRefresh();
    }, 400);
  }, [enabled, runRefresh]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void runRefresh();
    // Notifications table intentionally excluded — it's a firehose and admin
    // categories are derived from the source tables below.
    const tables = ['chat_messages', 'reports', 'orders', 'listings', 'contact_submissions', 'waitlist', 'profiles', 'brands'];
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
    const onSeen = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('admin-last-seen-updated', onSeen);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      channels.forEach((c) => supabase.removeChannel(c));
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('admin-last-seen-updated', onSeen);
    };
  }, [enabled, refresh, runRefresh]);

  const visibleBadges = enabled ? badges : EMPTY;
  return { badges: visibleBadges, total: getAdminBadgeTotal(visibleBadges), loading, refresh };
}

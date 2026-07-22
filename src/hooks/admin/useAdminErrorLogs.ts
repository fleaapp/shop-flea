import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ErrorLogRow = {
  id: string;
  created_at: string;
  source: 'client' | 'edge_function' | 'payment' | 'auth';
  severity: 'warning' | 'error' | 'critical';
  user_id: string | null;
  username: string | null;
  title: string;
  message: string;
  stack: string | null;
  route: string | null;
  device: Record<string, any> | null;
  context: Record<string, any> | null;
};

export type ErrorLogFilters = {
  source: 'all' | ErrorLogRow['source'];
  severity: 'all' | ErrorLogRow['severity'];
  sinceHours: number;
  search: string;
};

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-error-logs`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  // Skip when signed out — admin endpoint requires a real user JWT and would
  // otherwise 403 during logout / on public pages and pollute error logs.
  if (!token) throw new Error('admin-error-logs: not authenticated');
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`admin-error-logs ${res.status}`);
  return res.json() as Promise<T>;
}

export function useAdminErrorLogs() {
  const [rows, setRows] = useState<ErrorLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ErrorLogFilters>({
    source: 'all', severity: 'all', sinceHours: 24 * 7, search: '',
  });
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await call<{ rows: ErrorLogRow[] }>({
        action: 'list',
        source: filters.source,
        severity: filters.severity,
        sinceHours: filters.sinceHours,
        search: filters.search,
        limit: 200,
      });
      setRows(data.rows || []);
    } catch (e) {
      console.error('admin-error-logs list failed', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    refresh();
    // Poll every 10 s while the page is visible so the feed is effectively live.
    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
      timerRef.current = window.setTimeout(tick, 10_000);
    };
    timerRef.current = window.setTimeout(tick, 10_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const deleteRow = useCallback(async (id: string) => {
    await call({ action: 'delete', id });
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearOlderThan = useCallback(async (hours: number) => {
    await call({ action: 'clear', olderThanHours: hours });
    await refresh();
  }, [refresh]);

  return { rows, loading, filters, setFilters, refresh, deleteRow, clearOlderThan };
}

export async function fetchErrorCount24h(sinceIso?: string): Promise<number> {
  try {
    const payload: Record<string, unknown> = { action: 'count24h' };
    if (sinceIso) payload.since = sinceIso;
    const data = await call<{ count: number }>(payload);
    return data.count ?? 0;
  } catch { return 0; }
}

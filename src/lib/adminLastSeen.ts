import { supabase } from '@/lib/supabase';

// Shared "last seen" bookkeeping for admin badges. Each admin tab stores an
// ISO timestamp locally for instant UI updates and in the backend so opening a
// tab clears its badge across logout/login and other devices.

export type AdminTab =
  | 'support'
  | 'reports'
  | 'bans'
  | 'suggestions'
  | 'users'
  | 'listings'
  | 'refunds'
  | 'transactions'
  | 'contact'
  | 'waitlist'
  | 'brands'
  | 'error_logs';

const KEY: Record<AdminTab, string> = {
  support: 'admin_support_last_seen',
  reports: 'admin_reports_last_seen',
  bans: 'admin_bans_last_seen',
  suggestions: 'admin_suggestions_last_seen',
  users: 'admin_users_last_seen',
  listings: 'admin_listings_last_seen',
  refunds: 'admin_refunds_last_seen',
  transactions: 'admin_transactions_last_seen',
  contact: 'admin_contact_last_seen',
  waitlist: 'admin_waitlist_last_seen',
  brands: 'admin_brands_last_seen',
  error_logs: 'admin_error_logs_last_seen',
};

let backendLoadedForUser: string | null = null;

async function callAdminData<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('No active session.');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Admin request failed: ${res.status}`);
  return json as T;
}

export function getAdminLastSeen(tab: AdminTab): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY[tab]);
  } catch {
    return null;
  }
}

export function getAllAdminLastSeen(): Partial<Record<AdminTab, string>> {
  const out: Partial<Record<AdminTab, string>> = {};
  (Object.keys(KEY) as AdminTab[]).forEach((tab) => {
    const v = getAdminLastSeen(tab);
    if (v) out[tab] = v;
  });
  return out;
}

export async function loadAdminLastSeenFromBackend(): Promise<void> {
  if (typeof window === 'undefined') return;
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as any));
  const userId = data?.user?.id;
  if (!userId || backendLoadedForUser === userId) return;

  const { lastSeen } = await callAdminData<{ lastSeen?: Record<string, string> }>('getAdminLastSeen').catch(() => ({ lastSeen: {} }));
  const rows = Object.entries(lastSeen || {}).map(([tab, seen_at]) => ({ tab, seen_at }));
  if (!Array.isArray(rows)) return;

  try {
    rows.forEach((row) => {
      const tab = row.tab as AdminTab;
      const seenAt = typeof row.seen_at === 'string' ? row.seen_at : null;
      if (seenAt && KEY[tab]) {
        window.localStorage.setItem(KEY[tab], seenAt);
      }
    });
    backendLoadedForUser = userId;
  } catch {
    // ignore storage failures
  }
}

async function persistAdminTabSeen(tab: AdminTab, seenAt: string): Promise<void> {
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as any));
  const userId = data?.user?.id;
  if (!userId) return;

  await callAdminData('markAdminTabSeen', { tab, seenAt });
}

/**
 * Marks an admin tab as "seen now". Dispatches a `admin-last-seen-updated`
 * event so any mounted `useAdminBadges` hook can refresh instantly.
 */
export function markAdminTabSeen(tab: AdminTab): void {
  if (typeof window === 'undefined') return;
  const seenAt = new Date().toISOString();
  try {
    window.localStorage.setItem(KEY[tab], seenAt);
    window.dispatchEvent(new CustomEvent('admin-last-seen-updated', { detail: { tab } }));
    void persistAdminTabSeen(tab, seenAt).catch(() => undefined);
  } catch {
    // ignore storage failures
  }
}

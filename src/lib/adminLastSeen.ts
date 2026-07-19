// Shared "last seen" bookkeeping for admin badges. Each admin tab stores an
// ISO timestamp in localStorage; getBadges only counts rows newer than that
// timestamp, so opening a tab clears its badge until new rows arrive.

export type AdminTab =
  | 'users'
  | 'listings'
  | 'refunds'
  | 'transactions'
  | 'contact'
  | 'waitlist'
  | 'brands';

const KEY: Record<AdminTab, string> = {
  users: 'admin_users_last_seen',
  listings: 'admin_listings_last_seen',
  refunds: 'admin_refunds_last_seen',
  transactions: 'admin_transactions_last_seen',
  contact: 'admin_contact_last_seen',
  waitlist: 'admin_waitlist_last_seen',
  brands: 'admin_brands_last_seen',
};

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

/**
 * Marks an admin tab as "seen now". Dispatches a `admin-last-seen-updated`
 * event so any mounted `useAdminBadges` hook can refresh instantly.
 */
export function markAdminTabSeen(tab: AdminTab): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY[tab], new Date().toISOString());
    window.dispatchEvent(new CustomEvent('admin-last-seen-updated', { detail: { tab } }));
  } catch {
    // ignore storage failures
  }
}

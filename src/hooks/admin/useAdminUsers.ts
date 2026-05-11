import { useCallback, useEffect, useMemo, useState } from 'react';
import { callAdminData } from './useAdminData';
import { toast } from 'sonner';

export type AdminUser = {
  user_id: string;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
  last_sign_in_at: string | null;
  country_code: string | null;
  region_id: string | null;
  rating: number;
  total_reviews: number;
  report_strike_count: number;
  stripe_onboarding_complete: boolean;
  paypal_onboarding_complete: boolean;
  listings_total: number;
  listings_active: number;
  listings_sold: number;
  orders_as_buyer: number;
  orders_as_seller: number;
  buyer_volume: number;
  seller_volume: number;
  refunds_count: number;
  reports_against: number;
  risk_score: number;
};

export type UserStatusFilter = 'all' | 'active' | 'blocked' | 'suspended';
export type UserSortField = 'created_at' | 'last_sign_in_at' | 'username';

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [sort, setSort] = useState<UserSortField>('created_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ users: AdminUser[] }>('listUsers', { search, status, sort, dir });
      setUsers(data.users || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search, status, sort, dir]);

  useEffect(() => { load(); }, [load]);

  const performAction = useCallback(async (userId: string, type: string, reason?: string) => {
    try {
      const result = await callAdminData<{ ok: boolean; action_link?: string }>('userAction', { userId, type, reason });
      if (type === 'reset_password' && result.action_link) {
        await navigator.clipboard.writeText(result.action_link).catch(() => {});
        toast.success('Reset link copied to clipboard.');
      } else {
        toast.success(`Action "${type}" applied.`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Action failed.');
    }
  }, [load]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    blocked: users.filter(u => u.status === 'blocked').length,
    risky: users.filter(u => u.risk_score >= 50).length,
  }), [users]);

  return { users, loading, search, setSearch, status, setStatus, sort, setSort, dir, setDir, reload: load, performAction, stats };
}

export async function fetchUserDetail(userId: string) {
  return callAdminData<any>('getUserDetail', { userId });
}

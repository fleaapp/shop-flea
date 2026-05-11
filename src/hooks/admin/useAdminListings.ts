import { useCallback, useEffect, useMemo, useState } from 'react';
import { callAdminData } from './useAdminData';
import { toast } from 'sonner';

export type AdminListing = {
  id: string;
  title: string;
  brand: string;
  price: number;
  shipping_price: number | null;
  images: string[];
  status: string;
  category: string;
  subcategory: string | null;
  size: string;
  condition: string;
  user_id: string;
  region_id: string | null;
  created_at: string;
  updated_at: string;
  report_count: number;
  seller_profile: { username: string; avatar_url: string | null; status?: string | null; email?: string | null };
  favorites_count: number;
  comments_count: number;
  orders_count: number;
  is_duplicate: boolean;
  spam_signal: boolean;
};

export type ListingStatusFilter = 'all' | 'active' | 'sold' | 'removed' | 'hidden' | 'archived' | 'featured';
export type ListingSortField = 'created_at' | 'price' | 'report_count';

export function useAdminListings() {
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListingStatusFilter>('all');
  const [sort, setSort] = useState<ListingSortField>('created_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [minReports, setMinReports] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ listings: AdminListing[] }>('listListings', { search, status, sort, dir, minReports });
      setListings(data.listings || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load listings.');
    } finally {
      setLoading(false);
    }
  }, [search, status, sort, dir, minReports]);

  useEffect(() => { load(); }, [load]);

  const performAction = useCallback(async (listingId: string, type: string) => {
    try {
      await callAdminData('listingAction', { listingId, type });
      toast.success(`Listing ${type}.`);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Action failed.');
    }
  }, [load]);

  const stats = useMemo(() => ({
    total: listings.length,
    active: listings.filter(l => l.status === 'active').length,
    sold: listings.filter(l => l.status === 'sold').length,
    removed: listings.filter(l => l.status === 'removed').length,
    flagged: listings.filter(l => l.report_count > 0 || l.spam_signal).length,
  }), [listings]);

  return { listings, loading, search, setSearch, status, setStatus, sort, setSort, dir, setDir, minReports, setMinReports, reload: load, performAction, stats };
}

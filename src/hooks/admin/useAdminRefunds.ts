import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { callAdminData } from './useAdminData';

export type AdminRefundOrder = {
  id: string;
  order_number?: string | null;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  price: number;
  shipping_price: number;
  status: string;
  refunded_at: string | null;
  refund_reason?: string | null;
  created_at: string;
  updated_at: string;
  buyer_profile: { username: string; avatar_url: string | null } | null;
  seller_profile: { username: string; avatar_url: string | null } | null;
  listing: { title: string; images: string[]; price: number; status?: string | null } | null;
};

export type RefundFilter = 'all' | 'refunded' | 'requested';

export function useAdminRefunds() {
  const [orders, setOrders] = useState<AdminRefundOrder[]>([]);
  const [filter, setFilter] = useState<RefundFilter>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ orders: AdminRefundOrder[] }>('listRefunds', { filter });
      setOrders(data.orders ?? []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load refunds.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return { orders, loading, filter, setFilter, refresh: load };
}

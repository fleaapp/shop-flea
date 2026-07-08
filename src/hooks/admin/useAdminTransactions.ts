import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { callAdminData } from './useAdminData';
import {
  TransactionOrder,
  TransactionSummary,
  TransactionFilters,
  TransactionSortField,
  SortDirection,
  calcPlatformFee,
  getShippingStatus,
  getDaysOverdue,
} from '@/types/admin/transactions';

const DEFAULT_FILTERS: TransactionFilters = {
  dateFrom: null,
  dateTo: null,
  status: null,
  shippingStatus: null,
  flagged: false,
  overdue: false,
  search: '',
};

export function useAdminTransactions() {
  const [orders, setOrders] = useState<TransactionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [sortField, setSortField] = useState<TransactionSortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ orders: TransactionOrder[] }>('listTransactions');
      const enriched = (data.orders || []).map((o) => ({
        ...o,
        has_flags: getDaysOverdue(o) !== null,
      }));
      setOrders(enriched);
    } catch (e) {
      console.error('admin transactions fetch failed', e);
      toast({ title: 'Error', description: 'Failed to load transactions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter((o) => new Date(o.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59);
      result = result.filter((o) => new Date(o.created_at) <= to);
    }
    if (filters.status) result = result.filter((o) => o.status === filters.status);
    if (filters.shippingStatus) result = result.filter((o) => getShippingStatus(o) === filters.shippingStatus);
    if (filters.overdue) result = result.filter((o) => getDaysOverdue(o) !== null);
    if (filters.flagged) result = result.filter((o) => o.has_flags);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        o.buyer_profile?.username?.toLowerCase().includes(q) ||
        o.seller_profile?.username?.toLowerCase().includes(q) ||
        o.listing?.title?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'price': cmp = (a.price + a.shipping_price) - (b.price + b.shipping_price); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'buyer': cmp = (a.buyer_profile?.username || '').localeCompare(b.buyer_profile?.username || ''); break;
        case 'seller': cmp = (a.seller_profile?.username || '').localeCompare(b.seller_profile?.username || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [orders, filters, sortField, sortDir]);

  const summary: TransactionSummary = useMemo(() => {
    const r = filteredOrders;
    return {
      totalOrders: r.length,
      totalRevenue: r.reduce((s, o) => s + o.price + o.shipping_price, 0),
      platformEarnings: r.reduce((s, o) => s + calcPlatformFee(o.price + o.shipping_price), 0),
      refundTotal: r.filter((o) => o.status === 'refunded').reduce((s, o) => s + o.price, 0),
      ordersInProgress: r.filter((o) => o.status === 'awaiting' || o.status === 'shipped').length,
      overdueShipments: r.filter((o) => getDaysOverdue(o) !== null).length,
      disputedOrders: r.filter((o) => o.status === 'disputed').length,
    };
  }, [filteredOrders]);

  const updateFilter = (key: keyof TransactionFilters, value: any) =>
    setFilters((p) => ({ ...p, [key]: value }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const toggleSort = (field: TransactionSortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  return { orders: filteredOrders, allOrders: orders, loading, summary, filters, updateFilter, resetFilters, sortField, sortDir, toggleSort, refetch: fetchOrders };
}

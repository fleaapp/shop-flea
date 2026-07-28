import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

export type ApprovalKind = 'tracking' | 'delivery' | 'untracked' | 'dispute';

export type AdminApprovalOrder = {
  id: string;
  order_number: string | null;
  order_group_id: string | null;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  price: number;
  shipping_price: number;
  status: string;
  tracking_provider: string | null;
  tracking_number: string | null;
  tracking_approved_at: string | null;
  tracking_rejected_at: string | null;
  tracking_rejection_reason: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  admin_marked_delivered: boolean;
  dispute_window_ends_at: string | null;
  refunded_at: string | null;
  refund_requested_at: string | null;
  refund_requested_by: string | null;
  refund_request_reason: string | null;
  refund_request_deadline_at: string | null;
  refund_declined_at: string | null;
  refund_declined_reason: string | null;
  created_at: string;
  updated_at: string;
  listing: { title: string; images: string[] } | null;
  buyer_profile: { username: string | null; avatar_url: string | null } | null;
  seller_profile: { username: string | null; avatar_url: string | null } | null;
};

const BASE_SELECT = `
  id, order_number, order_group_id, buyer_id, seller_id, listing_id,
  price, shipping_price, status,
  tracking_provider, tracking_number, tracking_approved_at, tracking_rejected_at, tracking_rejection_reason,
  shipped_at, delivered_at, admin_marked_delivered, dispute_window_ends_at, refunded_at,
  refund_requested_at, refund_requested_by, refund_request_reason, refund_request_deadline_at,
  refund_declined_at, refund_declined_reason,
  created_at, updated_at
`;

async function hydrate(rows: any[]): Promise<AdminApprovalOrder[]> {
  if (!rows?.length) return [];
  const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))];
  const userIds = [...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id]).filter(Boolean))];
  const [listingsRes, profilesRes] = await Promise.all([
    listingIds.length
      ? supabase.from('listings').select('id, title, images').in('id', listingIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length
      ? supabase.from('profiles_public').select('user_id, username, avatar_url').in('user_id', userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const lmap = new Map((listingsRes.data ?? []).map((l: any) => [l.id, l]));
  const pmap = new Map((profilesRes.data ?? []).map((p: any) => [p.user_id, p]));
  return rows.map((r) => ({
    ...r,
    listing: r.listing_id ? lmap.get(r.listing_id) ?? null : null,
    buyer_profile: pmap.get(r.buyer_id) ?? null,
    seller_profile: pmap.get(r.seller_id) ?? null,
  }));
}

export function useAdminApprovals(kind: ApprovalKind) {
  const [orders, setOrders] = useState<AdminApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = (supabase as any).from('orders').select(BASE_SELECT).order('created_at', { ascending: false }).limit(200);
      if (kind === 'tracking') {
        q = q.eq('status', 'shipped').not('tracking_number', 'is', null).is('tracking_approved_at', null);
      } else if (kind === 'delivery') {
        q = q.eq('status', 'shipped').not('tracking_approved_at', 'is', null).is('delivered_at', null);
      } else {
        // Dispute queue: refund requests the seller has declined, awaiting Flea arbitration.
        q = q.not('refund_declined_at', 'is', null).is('refunded_at', null);
      }
      const { data, error } = await q;
      if (error) throw error;
      setOrders(await hydrate((data ?? []) as any[]));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const approveTracking = async (orderId: string) => {
    const { error } = await (supabase as any).rpc('admin_approve_tracking', { p_order_id: orderId });
    if (error) return toast.error(error.message);
    toast.success('Tracking approved.');
    load();
  };

  const rejectTracking = async (orderId: string, reason: string) => {
    const { error } = await (supabase as any).rpc('admin_reject_tracking', { p_order_id: orderId, p_reason: reason });
    if (error) return toast.error(error.message);
    toast.success('Tracking rejected.');
    load();
  };

  const markDelivered = async (orderId: string, orderGroupId: string | null) => {
    const { error } = await (supabase as any).rpc('mark_order_delivered', {
      p_order_id: orderGroupId ? null : orderId,
      p_order_group_id: orderGroupId,
      p_source: 'admin',
    });
    if (error) return toast.error(error.message);
    toast.success('Marked delivered.');
    load();
  };

  const completeOrder = async (orderId: string, orderGroupId: string | null) => {
    const { error } = await (supabase as any).rpc('complete_order', {
      p_order_id: orderGroupId ? null : orderId,
      p_order_group_id: orderGroupId,
    });
    if (error) return toast.error(error.message);
    toast.success('Order completed. Funds released.');
    load();
  };

  const forceRefund = async (orderId: string) => {
    const { data, error } = await invokeCloudFunction('stripe-connect-refund', {
      body: { orderId, reason: 'requested_by_customer', mode: 'single' },
    });
    if (error || (data as any)?.error) {
      return toast.error(error?.message || (data as any)?.error || 'Refund failed.');
    }
    toast.success('Refund issued to buyer.');
    load();
  };

  const dismissDispute = async (orderId: string) => {
    const { error } = await (supabase as any).rpc('admin_dismiss_refund_dispute', { p_order_id: orderId });
    if (error) return toast.error(error.message);
    toast.success('Dispute dismissed. Sale continues.');
    load();
  };

  return {
    orders,
    loading,
    refresh: load,
    approveTracking,
    rejectTracking,
    markDelivered,
    completeOrder,
    forceRefund,
    dismissDispute,
  };
}


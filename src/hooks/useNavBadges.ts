import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface NavBadgesData {
  buyer_orders: number;
  seller_to_ship: number;
  unread_buyer_msgs: number;
  unread_seller_msgs: number;
  seller_unread_per_order: Record<string, number>;
  unread_support: number;
  activity_unread: number;
}

const EMPTY: NavBadgesData = {
  buyer_orders: 0,
  seller_to_ship: 0,
  unread_buyer_msgs: 0,
  unread_seller_msgs: 0,
  seller_unread_per_order: {},
  unread_support: 0,
  activity_unread: 0,
};

const ACTIVE_ORDER_STATUSES = ['awaiting', 'shipped'] as const;

const isDemoOrder = (order: { payment_method?: string | null; checkout_reference?: string | null }) =>
  order.payment_method === 'demo' ||
  (typeof order.checkout_reference === 'string' && order.checkout_reference.startsWith('demo-'));

/**
 * Single consolidated query for all bottom-nav badge counts.
 * Replaces 4 separate hooks with one round-trip.
 */
export const useNavBadges = () => {
  const { user } = useAuth();

  const { data } = useQuery<NavBadgesData>({
    queryKey: ['nav-badges', user?.id],
    queryFn: async () => {
      if (!user?.id) return EMPTY;
      const { data } = await (supabase as any).rpc('get_nav_badges', { _user_id: user.id });
      const rpcBadges = data ? {
        unread_support: Number(data.unread_support) || 0,
        activity_unread: Number(data.activity_unread) || 0,
      } : {
        unread_support: 0,
        activity_unread: 0,
      };

      const [buyerOrdersRes, sellerOrdersRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, payment_method, checkout_reference')
          .eq('buyer_id', user.id)
          .in('status', [...ACTIVE_ORDER_STATUSES]),
        supabase
          .from('orders')
          .select('id, status, payment_method, checkout_reference')
          .eq('seller_id', user.id)
          .in('status', [...ACTIVE_ORDER_STATUSES]),
      ]);

      const buyerOrders = ((buyerOrdersRes.data ?? []) as any[]).filter((order) => !isDemoOrder(order));
      const sellerOrders = ((sellerOrdersRes.data ?? []) as any[]).filter((order) => !isDemoOrder(order));
      const buyerOrderIds = buyerOrders.map((order) => order.id).filter(Boolean);
      const sellerOrderIds = sellerOrders.map((order) => order.id).filter(Boolean);

      const [buyerMessagesRes, sellerMessagesRes] = await Promise.all([
        buyerOrderIds.length
          ? supabase
              .from('order_messages')
              .select('id')
              .in('order_id', buyerOrderIds)
              .neq('sender_id', user.id)
              .eq('read', false)
          : Promise.resolve({ data: [] }),
        sellerOrderIds.length
          ? supabase
              .from('order_messages')
              .select('id, order_id')
              .in('order_id', sellerOrderIds)
              .neq('sender_id', user.id)
              .eq('read', false)
          : Promise.resolve({ data: [] }),
      ]);

      const sellerUnreadPerOrder: Record<string, number> = {};
      for (const message of ((sellerMessagesRes.data ?? []) as any[])) {
        if (!message.order_id) continue;
        sellerUnreadPerOrder[message.order_id] = (sellerUnreadPerOrder[message.order_id] || 0) + 1;
      }

      return {
        buyer_orders: buyerOrders.length,
        seller_to_ship: sellerOrders.filter((order) => order.status === 'awaiting').length,
        unread_buyer_msgs: ((buyerMessagesRes.data ?? []) as any[]).length,
        unread_seller_msgs: ((sellerMessagesRes.data ?? []) as any[]).length,
        seller_unread_per_order: sellerUnreadPerOrder,
        unread_support: rpcBadges.unread_support,
        activity_unread: rpcBadges.activity_unread,
      };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return data || EMPTY;
};

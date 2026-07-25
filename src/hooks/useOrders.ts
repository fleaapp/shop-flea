import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { preloadImages } from '@/utils/preloadAssets';
import { toast } from 'sonner';
import { sendPushNotification } from '@/utils/pushNotify';

export type OrderStatus = 'awaiting' | 'shipped' | 'delivered' | 'completed' | 'refunded';

export const isOrderRefunded = (order: Pick<Order, 'status' | 'refunded_at'>) =>
  order.status === 'refunded' || !!order.refunded_at;
export const isOrderCompleted = (order: Pick<Order, 'status' | 'refunded_at'>) =>
  !isOrderRefunded(order) && order.status === 'completed';
export const isGroupRefunded = (group: { orders: Order[] }) =>
  group.orders.length > 0 && group.orders.every(isOrderRefunded);


export interface Order {
  id: string;
  order_group_id: string | null;
  order_number: string | null;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  tracking_provider: string | null;
  tracking_number: string | null;
  price: number;
  shipping_price: number;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
  payment_method?: string | null;
  checkout_reference?: string | null;
  // Buyer-protection lifecycle
  tracking_approved_at?: string | null;
  tracking_rejected_at?: string | null;
  tracking_rejection_reason?: string | null;
  admin_marked_delivered?: boolean | null;
  completed_at?: string | null;
  dispute_window_ends_at?: string | null;
  // Shipping address fields
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postcode: string | null;

  // Joined data
  listing?: {
    id: string;
    title: string;
    images: string[];
  };
  buyer_profile?: {
    username: string;
    avatar_url: string | null;
  };
  seller_profile?: {
    username: string;
    avatar_url: string | null;
  };
}

export interface OrderGroup {
  /**
   * If `order_group_id` is null, we fall back to the order's own id so legacy
   * orders still show up as single-item groups.
   */
  id: string;
  order_group_id: string | null;
  status: OrderStatus;
  created_at: string;
  buyer_id: string;
  seller_id: string;
  tracking_provider: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postcode: string | null;
  buyer_profile?: Order['buyer_profile'];
  seller_profile?: Order['seller_profile'];
  orders: Order[];
}

type RawOrderRow = Omit<Order, 'status' | 'listing' | 'buyer_profile' | 'seller_profile'> & {
  status: string;
};

const ORDER_REQUIRED_COLUMNS = [
  'id',
  'listing_id',
  'buyer_id',
  'seller_id',
  'status',
  'price',
  'shipping_price',
  'created_at',
] as const;

const ORDER_OPTIONAL_COLUMNS = [
  'order_group_id',
  'order_number',
  'tracking_provider',
  'tracking_number',
  'updated_at',
  'shipped_at',
  'delivered_at',
  'refunded_at',
  'refund_reason',
  'payment_method',
  'checkout_reference',
  'tracking_approved_at',
  'tracking_rejected_at',
  'tracking_rejection_reason',
  'admin_marked_delivered',
  'completed_at',
  'dispute_window_ends_at',
  'shipping_first_name',
  'shipping_last_name',
  'shipping_address',
  'shipping_city',
  'shipping_state',
  'shipping_postcode',
] as const;


const buildOrderSelectFields = (omitted = new Set<string>()) =>
  [...ORDER_REQUIRED_COLUMNS, ...ORDER_OPTIONAL_COLUMNS]
    .filter((column) => !omitted.has(column))
    .join(',\n  ');

const isMissingColumnError = (error: unknown, columnName: string) => {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';

  return (code === '42703' || code === 'PGRST204') && message.includes(columnName);
};

const normalizeOrderRows = (rows: unknown[]): RawOrderRow[] => {
  return rows.map((row) => {
    const typedRow = row as Partial<RawOrderRow>;

    return {
      ...(typedRow as RawOrderRow),
      order_group_id: typedRow.order_group_id ?? null,
      order_number: typedRow.order_number ?? null,
      tracking_provider: typedRow.tracking_provider ?? null,
      tracking_number: typedRow.tracking_number ?? null,
      updated_at: typedRow.updated_at ?? typedRow.created_at ?? new Date(0).toISOString(),
      shipped_at: typedRow.shipped_at ?? null,
      delivered_at: typedRow.delivered_at ?? null,
      refunded_at: typedRow.refunded_at ?? null,
      refund_reason: typedRow.refund_reason ?? null,
      payment_method: typedRow.payment_method ?? null,
      checkout_reference: typedRow.checkout_reference ?? null,
      tracking_approved_at: typedRow.tracking_approved_at ?? null,
      tracking_rejected_at: typedRow.tracking_rejected_at ?? null,
      tracking_rejection_reason: typedRow.tracking_rejection_reason ?? null,
      admin_marked_delivered: typedRow.admin_marked_delivered ?? false,
      completed_at: typedRow.completed_at ?? null,
      dispute_window_ends_at: typedRow.dispute_window_ends_at ?? null,
      shipping_first_name: typedRow.shipping_first_name ?? null,
      shipping_last_name: typedRow.shipping_last_name ?? null,
      shipping_address: typedRow.shipping_address ?? null,
      shipping_city: typedRow.shipping_city ?? null,
      shipping_state: typedRow.shipping_state ?? null,
      shipping_postcode: typedRow.shipping_postcode ?? null,
    };

  });
};

const isDemoOrder = (order: Partial<RawOrderRow>) =>
  order.payment_method === 'demo' ||
  (typeof order.checkout_reference === 'string' && order.checkout_reference.startsWith('demo-'));

const ORDER_SELECT_FIELDS = buildOrderSelectFields();

const getEffectiveOrderStatus = (order: Pick<RawOrderRow, 'status' | 'refunded_at'>): OrderStatus => {
  if (order.status === 'refunded' || !!order.refunded_at) return 'refunded';
  if (order.status === 'shipped') return 'shipped';
  if (order.status === 'delivered') return 'delivered';
  if (order.status === 'completed') return 'completed';
  return 'awaiting';
};

const getGroupStatus = (orders: Order[]): OrderStatus => {
  if (orders.length > 0 && orders.every(isOrderRefunded)) return 'refunded';
  if (orders.some((o) => o.status === 'awaiting' && !isOrderRefunded(o))) return 'awaiting';
  if (orders.some((o) => o.status === 'shipped' && !isOrderRefunded(o))) return 'shipped';
  if (orders.some((o) => o.status === 'delivered' && !isOrderRefunded(o))) return 'delivered';
  return 'completed';
};


const groupOrders = (orders: Order[]): OrderGroup[] => {
  const groups = new Map<string, OrderGroup>();

  for (const order of orders) {
    const key = order.order_group_id ?? order.id;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: key,
        order_group_id: order.order_group_id ?? null,
        status: getGroupStatus([order]),
        created_at: order.created_at,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        tracking_provider: order.tracking_provider,
        tracking_number: order.tracking_number,
        shipped_at: order.shipped_at,
        delivered_at: order.delivered_at,
        shipping_first_name: order.shipping_first_name,
        shipping_last_name: order.shipping_last_name,
        shipping_address: order.shipping_address,
        shipping_city: order.shipping_city,
        shipping_state: order.shipping_state,
        shipping_postcode: order.shipping_postcode,
        buyer_profile: order.buyer_profile,
        seller_profile: order.seller_profile,
        orders: [order],
      });

      continue;
    }

    existing.orders.push(order);
    existing.status = getGroupStatus(existing.orders);

    // Keep the first non-null tracking values (should be consistent within a group)
    existing.tracking_provider = existing.tracking_provider ?? order.tracking_provider;
    existing.tracking_number = existing.tracking_number ?? order.tracking_number;
    existing.shipped_at = existing.shipped_at ?? order.shipped_at;
    existing.delivered_at = existing.delivered_at ?? order.delivered_at;
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

const fetchOrdersForUser = async (column: 'buyer_id' | 'seller_id', userId: string): Promise<RawOrderRow[]> => {
  const omittedColumns = new Set<string>();

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select(omittedColumns.size ? buildOrderSelectFields(omittedColumns) : ORDER_SELECT_FIELDS)
      .eq(column, userId)
      .order('created_at', { ascending: false })
      .limit(500);

    const missingColumn = ORDER_OPTIONAL_COLUMNS.find(
      (optionalColumn) => !omittedColumns.has(optionalColumn) && isMissingColumnError(error, optionalColumn)
    );

    if (missingColumn) {
      omittedColumns.add(missingColumn);
      continue;
    }

    if (error) throw error;
    const normalized = normalizeOrderRows((data ?? []) as unknown[]).filter((order) => !isDemoOrder(order));
    if (typeof window !== 'undefined') {
      const refundedRows = normalized.filter((o) => !!o.refunded_at).map((o) => ({ id: o.id, refunded_at: o.refunded_at, status: o.status }));
      if (refundedRows.length) console.log('[useOrders] refunded rows for', column, userId, refundedRows);
    }
    return normalized;
  }
};

export function useOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch orders where user is the buyer
  const { data: buyerOrders = [], isLoading: loadingBuyerOrders } = useQuery({
    queryKey: ['orders', 'buyer', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const orders = await fetchOrdersForUser('buyer_id', user.id);
      if (!orders || orders.length === 0) return [];

      // Fetch listing and profile data
      const listingIds = [...new Set(orders.map(o => o.listing_id))];
      const sellerIds = [...new Set(orders.map(o => o.seller_id))];
      const allProfileIds = [...new Set([...sellerIds, user.id])];

      const [listingsRes, profilesRes] = await Promise.all([
        supabase.from('listings').select('id, title, images').in('id', listingIds),
        supabase.from('profiles_public').select('user_id, username, avatar_url').in('user_id', allProfileIds),
      ]);

      const listingsMap = new Map(listingsRes.data?.map(l => [l.id, l]) || []);
      const profilesMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);

      // Preload listing images and avatars
      const imagesToPreload = [
        ...(listingsRes.data?.flatMap(l => l.images?.slice(0, 1) || []) || []),
        ...(profilesRes.data?.map(p => p.avatar_url).filter(Boolean) || []),
      ] as string[];
      if (imagesToPreload.length) preloadImages(imagesToPreload);

      return orders.map(order => ({
        ...order,
        status: getEffectiveOrderStatus(order),
        listing: listingsMap.get(order.listing_id),
        seller_profile: profilesMap.get(order.seller_id),
        buyer_profile: profilesMap.get(order.buyer_id),
      })) as Order[];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const { data: sellerOrders = [], isLoading: loadingSellerOrders } = useQuery({
    queryKey: ['orders', 'seller', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const orders = await fetchOrdersForUser('seller_id', user.id);
      if (!orders || orders.length === 0) return [];

      // Fetch listing and profile data
      const listingIds = [...new Set(orders.map(o => o.listing_id))];
      const buyerIds = [...new Set(orders.map(o => o.buyer_id))];
      const allProfileIds = [...new Set([...buyerIds, user.id])];

      const [listingsRes, profilesRes] = await Promise.all([
        supabase.from('listings').select('id, title, images').in('id', listingIds),
        supabase.from('profiles_public').select('user_id, username, avatar_url').in('user_id', allProfileIds),
      ]);

      const listingsMap = new Map(listingsRes.data?.map(l => [l.id, l]) || []);
      const profilesMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);

      // Preload listing images and avatars
      const imagesToPreload = [
        ...(listingsRes.data?.flatMap(l => l.images?.slice(0, 1) || []) || []),
        ...(profilesRes.data?.map(p => p.avatar_url).filter(Boolean) || []),
      ] as string[];
      if (imagesToPreload.length) preloadImages(imagesToPreload);

      return orders.map(order => ({
        ...order,
        status: getEffectiveOrderStatus(order),
        listing: listingsMap.get(order.listing_id),
        buyer_profile: profilesMap.get(order.buyer_id),
        seller_profile: profilesMap.get(order.seller_id),
      })) as Order[];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });


  const buyerOrderGroups = useMemo(() => groupOrders(buyerOrders), [buyerOrders]);
  const sellerOrderGroups = useMemo(() => groupOrders(sellerOrders), [sellerOrders]);

  // Mark order as shipped (seller action)
  const markAsShipped = useMutation({
    mutationFn: async ({
      orderId,
      orderGroupId,
      trackingProvider,
      trackingNumber,
    }: {
      orderId?: string;
      orderGroupId?: string;
      trackingProvider: string;
      trackingNumber: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!orderId && !orderGroupId) throw new Error('orderId or orderGroupId is required');

      // SECURITY DEFINER RPC — only updates status/tracking/shipped_at; verifies seller_id == auth.uid()
      const { error } = await (supabase as any).rpc('mark_order_shipped', {
        p_order_id: orderId ?? null,
        p_order_group_id: orderGroupId ?? null,
        p_tracking_provider: trackingProvider,
        p_tracking_number: trackingNumber,
      });
      if (error) throw error;

      // Push the buyer(s). DB trigger notify_on_order_status_change already
      // inserted the notification row synchronously, so send-push-notification
      // will find matching proof.
      try {
        let q = supabase
          .from('orders')
          .select('id, buyer_id, listing_id')
          .eq('status', 'shipped');
        if (orderId) q = q.eq('id', orderId);
        if (orderGroupId) q = q.eq('order_group_id', orderGroupId);
        const { data: rows } = await q;
        const seen = new Set<string>();
        for (const row of rows || []) {
          if (seen.has(row.buyer_id)) continue;
          seen.add(row.buyer_id);
          await sendPushNotification(row.buyer_id, {
            type: 'order_shipped',
            title: 'Order Shipped',
            message: 'Your order is on the way. Tap for details.',
            related_listing_id: row.listing_id ?? undefined,
            related_order_id: row.id,
            related_user_id: user.id,
          });
        }
      } catch (err) {
        console.warn('Shipped push notify failed:', err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order marked as shipped');
    },
    onError: (error) => {
      console.error('Error marking as shipped:', error);
      toast.error('Failed to update order');
    },
  });

  // Mark order as delivered (buyer action)
  const markAsDelivered = useMutation({
    mutationFn: async (input: string | { orderId?: string; orderGroupId?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const orderId = typeof input === 'string' ? input : input.orderId;
      const orderGroupId = typeof input === 'string' ? undefined : input.orderGroupId;

      if (!orderId && !orderGroupId) throw new Error('orderId or orderGroupId is required');

      const { error } = await (supabase as any).rpc('mark_order_delivered', {
        p_order_id: orderId ?? null,
        p_order_group_id: orderGroupId ?? null,
      });
      if (error) throw error;

      // Delivered notification recipient is the buyer (== caller), so the
      // self-push path allows this without cross-user proof.
      try {
        await sendPushNotification(user.id, {
          type: 'order_delivered',
          title: 'Order Delivered',
          message: 'Your order is home safe 🏠 Tap for details.',
          related_order_id: orderId ?? undefined,
        });
      } catch (err) {
        console.warn('Delivered push notify failed:', err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order marked as delivered');
    },
    onError: (error) => {
      console.error('Error marking as delivered:', error);
      toast.error('Failed to update order');
    },
  });

  // Buyer/admin: mark order completed (releases funds)
  const completeOrder = useMutation({
    mutationFn: async (input: { orderId?: string; orderGroupId?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { orderId, orderGroupId } = input;
      if (!orderId && !orderGroupId) throw new Error('orderId or orderGroupId is required');
      const { error } = await (supabase as any).rpc('complete_order', {
        p_order_id: orderId ?? null,
        p_order_group_id: orderGroupId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order completed');
    },
    onError: (error) => {
      console.error('Error completing order:', error);
      toast.error('Failed to complete order');
    },
  });

  return {
    buyerOrders,
    sellerOrders,
    buyerOrderGroups,
    sellerOrderGroups,
    loadingBuyerOrders,
    loadingSellerOrders,
    markAsShipped,
    markAsDelivered,
    completeOrder,
  };
}

    markAsDelivered,
  };
}

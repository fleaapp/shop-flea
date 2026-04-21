import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { preloadImages } from '@/utils/preloadAssets';
import { toast } from 'sonner';
import { sendPushNotification } from '@/utils/pushNotify';

export type OrderStatus = 'awaiting' | 'shipped' | 'delivered';

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

const ORDER_SELECT_COLUMNS = [
  'id',
  'order_group_id',
  'order_number',
  'listing_id',
  'buyer_id',
  'seller_id',
  'status',
  'tracking_provider',
  'tracking_number',
  'price',
  'shipping_price',
  'created_at',
  'updated_at',
  'shipped_at',
  'delivered_at',
  'shipping_first_name',
  'shipping_last_name',
  'shipping_address',
  'shipping_city',
  'shipping_state',
  'shipping_postcode',
] as const;

const ORDER_OPTIONAL_COLUMNS = ['order_number'] as const;

const buildOrderSelectFields = (omitted = new Set<string>()) =>
  ORDER_SELECT_COLUMNS.filter((column) => !omitted.has(column)).join(',\n  ');

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
      order_number: typedRow.order_number ?? null,
    };
  });
};

const ORDER_SELECT_FIELDS = buildOrderSelectFields();

const getGroupStatus = (orders: Order[]): OrderStatus => {
  if (orders.some((o) => o.status === 'awaiting')) return 'awaiting';
  if (orders.some((o) => o.status === 'shipped')) return 'shipped';
  return 'delivered';
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
        status: order.status,
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
      .order('created_at', { ascending: false });

    const missingColumn = ORDER_OPTIONAL_COLUMNS.find(
      (optionalColumn) => !omittedColumns.has(optionalColumn) && isMissingColumnError(error, optionalColumn)
    );

    if (missingColumn) {
      omittedColumns.add(missingColumn);
      continue;
    }

    if (error) throw error;
    return normalizeOrderRows((data ?? []) as unknown[]);
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
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', allProfileIds),
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
        status: order.status as OrderStatus,
        listing: listingsMap.get(order.listing_id),
        seller_profile: profilesMap.get(order.seller_id),
        buyer_profile: profilesMap.get(order.buyer_id),
      })) as Order[];
    },
    enabled: !!user?.id,
  });

  // Fetch orders where user is the seller (sales)
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
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', allProfileIds),
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
        status: order.status as OrderStatus,
        listing: listingsMap.get(order.listing_id),
        buyer_profile: profilesMap.get(order.buyer_id),
        seller_profile: profilesMap.get(order.seller_id),
      })) as Order[];
    },
    enabled: !!user?.id,
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

      let query = supabase
        .from('orders')
        .update({
          status: 'shipped',
          tracking_provider: trackingProvider,
          tracking_number: trackingNumber,
          shipped_at: new Date().toISOString(),
        })
        .eq('seller_id', user.id);

      query = orderGroupId ? query.eq('order_group_id', orderGroupId) : query.eq('id', orderId!);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order marked as shipped');
      // Push notification to buyer - find the order to get buyer_id
      const order = sellerOrders.find(o =>
        variables.orderGroupId ? o.order_group_id === variables.orderGroupId : o.id === variables.orderId
      );
      if (order) {
        sendPushNotification(order.buyer_id, {
          type: 'order_shipped',
          title: 'Order Shipped',
          message: `📦 Your order ${order.listing?.title || 'item'} is on the way!`,
          related_listing_id: order.listing_id,
          related_order_id: order.id,
        }).catch(() => {});
      }
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

      let query = supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('buyer_id', user.id);

      query = orderGroupId ? query.eq('order_group_id', orderGroupId) : query.eq('id', orderId!);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order marked as delivered');
      // Push notification to buyer (delivered confirmation)
      const oid = typeof variables === 'string' ? variables : variables.orderId;
      const ogid = typeof variables === 'string' ? undefined : variables.orderGroupId;
      const order = buyerOrders.find(o =>
        ogid ? o.order_group_id === ogid : o.id === oid
      );
      if (order) {
        sendPushNotification(order.buyer_id, {
          type: 'order_delivered',
          title: 'Order Delivered',
          message: `Delivered! Your order ${order.listing?.title || 'item'} is home safe 🏠`,
          related_listing_id: order.listing_id,
          related_order_id: order.id,
        }).catch(() => {});
      }
    },
    onError: (error) => {
      console.error('Error marking as delivered:', error);
      toast.error('Failed to update order');
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
  };
}

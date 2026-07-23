import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

type OrderChatRole = 'buyer' | 'seller' | 'unknown';

type ClearOrderChatBadgeOptions = {
  queryClient: QueryClient;
  userId: string;
  threadId: string;
  orderIds?: string[];
  role?: OrderChatRole;
};

const uniqueIds = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));

const toUnreadMap = (value: unknown): Map<string, number> => {
  if (value instanceof Map) return new Map(value);
  if (Array.isArray(value)) return new Map(value as [string, number][]);
  if (value && typeof value === 'object') {
    return new Map(Object.entries(value as Record<string, number>));
  }
  return new Map<string, number>();
};

export const clearOrderChatBadges = ({
  queryClient,
  userId,
  threadId,
  orderIds = [],
  role = 'unknown',
}: ClearOrderChatBadgeOptions) => {
  const ids = uniqueIds([threadId, ...orderIds]);
  if (ids.length === 0) return;

  let unreadRemoved = 0;
  queryClient.setQueryData<any>(['unread-order-messages', userId], (prev: any) => {
    if (!prev) return prev;
    const perOrder = toUnreadMap(prev.perOrder);
    let removed = 0;
    ids.forEach((id) => {
      removed += Number(perOrder.get(id)) || 0;
      perOrder.delete(id);
    });
    unreadRemoved = removed;
    return { ...prev, total: Math.max(0, Number(prev.total || 0) - removed), perOrder };
  });

  queryClient.setQueryData<any>(['nav-badges', userId], (prev: any) => {
    if (!prev) return prev;
    const seller = { ...(prev.seller_unread_per_order || {}) };
    let sellerRemoved = 0;
    ids.forEach((id) => {
      sellerRemoved += Number(seller[id]) || 0;
      delete seller[id];
    });

    const buyerDrop = role === 'buyer' || role === 'unknown' ? unreadRemoved : 0;
    const sellerDrop = role === 'seller' || role === 'unknown' ? Math.max(sellerRemoved, unreadRemoved) : 0;

    return {
      ...prev,
      seller_unread_per_order: seller,
      unread_buyer_msgs: Math.max(0, Number(prev.unread_buyer_msgs || 0) - buyerDrop),
      unread_seller_msgs: Math.max(0, Number(prev.unread_seller_msgs || 0) - sellerDrop),
    };
  });

  const idSet = new Set(ids);
  let notificationsCleared = 0;
  queryClient.setQueryData<any[]>(['notifications', userId], (prev) => {
    if (!Array.isArray(prev)) return prev;
    const next = prev.map((notification: any) => {
      if (
        !notification?.is_read &&
        (notification?.type === 'order_message_buyer' || notification?.type === 'order_message_seller') &&
        notification?.related_order_id &&
        idSet.has(notification.related_order_id)
      ) {
        notificationsCleared += 1;
        return { ...notification, is_read: true };
      }
      return notification;
    });
    return notificationsCleared > 0 ? next : prev;
  });

  if (notificationsCleared > 0) {
    queryClient.setQueryData<any>(['nav-badges', userId], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        activity_unread: Math.max(0, Number(prev.activity_unread || 0) - notificationsCleared),
      };
    });
  }
};

export const markOrderChatRead = (threadId: string) =>
  (supabase as any)
    .rpc('mark_order_thread_read', { _thread_id: threadId })
    .then(async (result: any) => {
      if (!result?.error) return { data: result.data, error: null, response: null };

      // Fallback for environments where the RPC has not propagated yet. The
      // edge function now has explicit PATCH CORS headers, so this should also
      // complete reliably.
      return invokeCloudFunction('order-messages', {
        method: 'PATCH',
        query: { orderId: threadId },
      });
    });

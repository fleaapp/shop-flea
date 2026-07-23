import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useUnreadOrderMessages = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['unread-order-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, perOrder: new Map<string, number>() };

      // Only count messages on orders the user can still open — refunded /
      // delivered-locked chats aren't reachable in the UI, so leaving them in
      // this query traps the sales dot on forever.
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in('status', ['awaiting', 'shipped']);

      if (!orders || orders.length === 0) return { total: 0, perOrder: new Map<string, number>() };

      const orderIds = orders.map(o => o.id);

      // Fetch unread messages not sent by current user
      const { data: messages } = await supabase
        .from('order_messages')
        .select('id, order_id')
        .in('order_id', orderIds)
        .neq('sender_id', user.id)
        .eq('read', false);

      if (!messages || messages.length === 0) return { total: 0, perOrder: new Map<string, number>() };

      const perOrder = new Map<string, number>();
      for (const msg of messages) {
        const oid = msg.order_id;
        perOrder.set(oid, (perOrder.get(oid) || 0) + 1);
      }

      return { total: messages.length, perOrder };
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const total = data?.total || 0;
  const perOrder = data?.perOrder || new Map<string, number>();

  const getGroupUnread = (orderId: string) => perOrder.get(orderId) || 0;

  return { total, perOrder, getGroupUnread, isLoading };
};

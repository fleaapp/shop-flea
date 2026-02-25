import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useUnreadOrderMessages = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['unread-order-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, perGroup: new Map<string, number>() };

      // Get all orders where user is buyer or seller to find their order_group_ids
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_group_id, buyer_id, seller_id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (!orders || orders.length === 0) return { total: 0, perGroup: new Map<string, number>() };

      // Build set of group IDs (use order id as fallback)
      const groupIds = [...new Set(orders.map(o => o.order_group_id || o.id))];

      // Fetch unread messages not sent by current user
      const { data: messages } = await supabase
        .from('order_messages')
        .select('id, order_group_id')
        .in('order_group_id', groupIds)
        .neq('sender_id', user.id)
        .eq('read', false);

      if (!messages || messages.length === 0) return { total: 0, perGroup: new Map<string, number>() };

      const perGroup = new Map<string, number>();
      for (const msg of messages) {
        perGroup.set(msg.order_group_id, (perGroup.get(msg.order_group_id) || 0) + 1);
      }

      return { total: messages.length, perGroup };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const total = data?.total || 0;
  const perGroup = data?.perGroup || new Map<string, number>();

  const getGroupUnread = (groupId: string) => perGroup.get(groupId) || 0;

  return { total, perGroup, getGroupUnread, isLoading };
};

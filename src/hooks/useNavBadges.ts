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
      const { data, error } = await (supabase as any).rpc('get_nav_badges', { _user_id: user.id });
      if (error || !data) return EMPTY;
      return {
        buyer_orders: Number(data.buyer_orders) || 0,
        seller_to_ship: Number(data.seller_to_ship) || 0,
        unread_buyer_msgs: Number(data.unread_buyer_msgs) || 0,
        unread_seller_msgs: Number(data.unread_seller_msgs) || 0,
        seller_unread_per_order: (data.seller_unread_per_order as Record<string, number>) || {},
        unread_support: Number(data.unread_support) || 0,
        activity_unread: Number(data.activity_unread) || 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  return data || EMPTY;
};

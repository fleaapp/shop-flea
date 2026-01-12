import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export type OrderStatus = 'awaiting' | 'shipped' | 'delivered';

export interface Order {
  id: string;
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

export function useOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch orders where user is the buyer
  const { data: buyerOrders = [], isLoading: loadingBuyerOrders } = useQuery({
    queryKey: ['orders', 'buyer', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      // Fetch listing and profile data
      const listingIds = [...new Set(orders.map(o => o.listing_id))];
      const sellerIds = [...new Set(orders.map(o => o.seller_id))];

      const [listingsRes, profilesRes] = await Promise.all([
        supabase.from('listings').select('id, title, images').in('id', listingIds),
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', sellerIds),
      ]);

      const listingsMap = new Map(listingsRes.data?.map(l => [l.id, l]) || []);
      const profilesMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);

      return orders.map(order => ({
        ...order,
        status: order.status as OrderStatus,
        listing: listingsMap.get(order.listing_id),
        seller_profile: profilesMap.get(order.seller_id),
      })) as Order[];
    },
    enabled: !!user?.id,
  });

  // Fetch orders where user is the seller (sales)
  const { data: sellerOrders = [], isLoading: loadingSellerOrders } = useQuery({
    queryKey: ['orders', 'seller', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      // Fetch listing and profile data
      const listingIds = [...new Set(orders.map(o => o.listing_id))];
      const buyerIds = [...new Set(orders.map(o => o.buyer_id))];

      const [listingsRes, profilesRes] = await Promise.all([
        supabase.from('listings').select('id, title, images').in('id', listingIds),
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', buyerIds),
      ]);

      const listingsMap = new Map(listingsRes.data?.map(l => [l.id, l]) || []);
      const profilesMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);

      return orders.map(order => ({
        ...order,
        status: order.status as OrderStatus,
        listing: listingsMap.get(order.listing_id),
        buyer_profile: profilesMap.get(order.buyer_id),
      })) as Order[];
    },
    enabled: !!user?.id,
  });

  // Mark order as shipped (seller action)
  const markAsShipped = useMutation({
    mutationFn: async ({ 
      orderId, 
      trackingProvider, 
      trackingNumber 
    }: { 
      orderId: string; 
      trackingProvider: string; 
      trackingNumber: string;
    }) => {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'shipped',
          tracking_provider: trackingProvider,
          tracking_number: trackingNumber,
          shipped_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('seller_id', user?.id);

      if (error) throw error;
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
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('buyer_id', user?.id);

      if (error) throw error;
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

  return {
    buyerOrders,
    sellerOrders,
    loadingBuyerOrders,
    loadingSellerOrders,
    markAsShipped,
    markAsDelivered,
  };
}

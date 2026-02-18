import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  reviewer_role?: 'buyer' | 'seller';
  reviewer_profile?: {
    username: string;
    avatar_url: string | null;
    user_id: string;
  };
  order?: {
    listing_id?: string;
    listing?: {
      id: string;
      images: string[];
      title: string;
    };
  };
}

export function useUserReviews(userId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // First fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .eq('reviewed_user_id', userId)
        .order('created_at', { ascending: false });
      
      if (reviewsError) throw reviewsError;
      if (!reviewsData || reviewsData.length === 0) return [];
      
      // Fetch reviewer profiles
      const reviewerIds = [...new Set(reviewsData.map(r => r.reviewer_id))];
      // Use profiles_public view — no RLS restrictions, so cross-region reviewer profiles load correctly
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, username, avatar_url')
        .in('user_id', reviewerIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      
      // Fetch order listings and buyer/seller info
      const orderIds = [...new Set(reviewsData.map(r => r.order_id))];
      const { data: orders } = await supabase
        .from('orders')
        .select('id, listing_id, buyer_id, seller_id')
        .in('id', orderIds);
      
      const listingIds = [...new Set((orders || []).map(o => o.listing_id))];
      const { data: listings } = await supabase
        .from('listings')
        .select('id, images, title')
        .in('id', listingIds);
      
      const listingMap = new Map((listings || []).map(l => [l.id, l]));
      const orderMap = new Map((orders || []).map(o => [o.id, o]));
      
      return reviewsData.map(review => {
        const order = orderMap.get(review.order_id);
        const reviewerRole: 'buyer' | 'seller' | undefined = order
          ? (order.buyer_id === review.reviewer_id ? 'buyer' : 'seller')
          : undefined;
        const listing = order ? listingMap.get(order.listing_id) : undefined;
        return {
          ...review,
          reviewer_role: reviewerRole,
          reviewer_profile: profileMap.get(review.reviewer_id) || { username: '@user', avatar_url: null, user_id: review.reviewer_id },
          order: {
            listing_id: order?.listing_id,
            listing: listing ? { ...listing } : undefined,
          }
        };
      }) as Review[];
    },
    enabled: !!userId,
  });
}

export function useCanReview(orderId: string | undefined, reviewedUserId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['can-review', orderId, user?.id],
    queryFn: async () => {
      if (!orderId || !user?.id || !reviewedUserId) return false;
      
      // Check if order is delivered and user is buyer/seller
      const { data: order } = await supabase
        .from('orders')
        .select('status, buyer_id, seller_id')
        .eq('id', orderId)
        .maybeSingle();
      
      if (!order || order.status !== 'delivered') return false;
      if (order.buyer_id !== user.id && order.seller_id !== user.id) return false;
      
      // Check if review already exists
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', orderId)
        .eq('reviewer_id', user.id)
        .maybeSingle();
      
      return !existingReview;
    },
    enabled: !!orderId && !!user?.id && !!reviewedUserId,
  });
}

export function useExistingReview(orderId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['existing-review', orderId, user?.id],
    queryFn: async () => {
      if (!orderId || !user?.id) return null;
      
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('order_id', orderId)
        .eq('reviewer_id', user.id)
        .maybeSingle();
      
      return data;
    },
    enabled: !!orderId && !!user?.id,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      orderId,
      reviewedUserId,
      rating,
      comment,
      photoUrl,
    }: {
      orderId: string;
      reviewedUserId: string;
      rating: number;
      comment: string;
      photoUrl?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Use raw REST API to bypass PostgREST schema cache issues (PGRST204)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const externalUrl = 'https://dzglehiopfgfjmxtejve.supabase.co';
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z2xlaGlvcGZnZmpteHRlanZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI0MjUsImV4cCI6MjA4NDU0ODQyNX0.qfOBjubnuod5iGF_G_gH2ZhMDJ1fVwAO9p5BZSxG0xI';

      const payload: Record<string, unknown> = {
        order_id: orderId,
        reviewer_id: user.id,
        reviewed_user_id: reviewedUserId,
        rating,
        comment: comment || null,
        photo_url: photoUrl || null,
      };

      const res = await fetch(`${externalUrl}/rest/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('Review insert error:', errBody);
        throw new Error(errBody.message || errBody.details || `HTTP ${res.status}`);
      }

      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', variables.reviewedUserId] });
      queryClient.invalidateQueries({ queryKey: ['can-review'] });
      queryClient.invalidateQueries({ queryKey: ['existing-review'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type NotificationType = 
  | 'price_drop_cart'
  | 'price_drop_wishlist'
  | 'cart_item_sold'
  | 'wishlist_item_sold'
  | 'cart_wishlist_item_sold'
  | 'new_review'
  | 'item_sold'
  | 'order_shipped'
  | 'order_delivered'
  | 'new_comment'
  | 'comment_reply';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  related_listing_id: string | null;
  related_user_id: string | null;
  listing?: {
    id: string;
    title: string;
    images: string[];
  } | null;
  related_user?: {
    username: string;
    avatar_url: string | null;
  } | null;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch notifications
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!notificationsData || notificationsData.length === 0) return [];

      // Get unique listing IDs and user IDs
      const listingIds = [...new Set(notificationsData.map(n => n.related_listing_id).filter(Boolean))] as string[];
      const userIds = [...new Set(notificationsData.map(n => n.related_user_id).filter(Boolean))] as string[];

      // Fetch related listings
      let listingsMap: Record<string, { id: string; title: string; images: string[] }> = {};
      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, title, images')
          .in('id', listingIds);
        
        if (listings) {
          listingsMap = Object.fromEntries(listings.map(l => [l.id, l]));
        }
      }

      // Fetch related users
      let usersMap: Record<string, { username: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', userIds);
        
        if (users) {
          usersMap = Object.fromEntries(users.map(u => [u.user_id, { username: u.username, avatar_url: u.avatar_url }]));
        }
      }

      // Combine data
      return notificationsData.map(n => ({
        ...n,
        listing: n.related_listing_id ? listingsMap[n.related_listing_id] || null : null,
        related_user: n.related_user_id ? usersMap[n.related_user_id] || null : null,
      })) as Notification[];
    },
    enabled: !!user?.id,
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
};

export const getNotificationMessage = (type: string, username?: string, message?: string | null): string => {
  // For comment notifications, use the message from the database which includes context
  if ((type === 'new_comment' || type === 'comment_reply') && message) {
    return message;
  }
  
  const displayUsername = username?.startsWith('@') ? username : username ? `@${username}` : undefined;
  
  switch (type) {
    case 'price_drop_cart':
      return 'Price dropped on an item in your cart!';
    case 'price_drop_wishlist':
      return 'Price dropped on an item in your wishlist!';
    case 'cart_item_sold':
      return message ? `Your cart's feeling lighter… ${message} just sold. 🛒🤷` : 'An item in your cart was sold.';
    case 'wishlist_item_sold':
      return message ? `Too slow… ${message} from your Wishlist just found a new home. 😢🏠` : 'An item in your wishlist was sold.';
    case 'cart_wishlist_item_sold':
      return message ? `Double heartbreak 💔 - ${message} from your Cart & Wishlist has sold.` : 'An item from your Cart & Wishlist has sold.';
    case 'new_review':
      return displayUsername ? `${displayUsername} left you a review.` : 'You received a new review.';
    case 'item_sold':
      return displayUsername ? `Sold to ${displayUsername}!` : 'Your item was sold!';
    case 'order_shipped':
      return 'Your order has been shipped!';
    case 'order_delivered':
      return 'Your order has been delivered!';
    case 'new_comment':
      return displayUsername ? `${displayUsername} commented on your listing.` : 'Someone commented on your listing.';
    case 'comment_reply':
      return displayUsername ? `${displayUsername} replied to your comment.` : 'Someone replied to your comment.';
    default:
      return 'New notification';
  }
};

export const getNotificationEmoji = (type: string): string => {
  switch (type) {
    case 'price_drop_cart':
    case 'price_drop_wishlist':
      return '💰';
    case 'cart_item_sold':
      return '🛒';
    case 'wishlist_item_sold':
      return '😢';
    case 'cart_wishlist_item_sold':
      return '💔';
    case 'new_review':
      return '⭐';
    case 'item_sold':
      return '🎉';
    case 'order_shipped':
      return '📦';
    case 'order_delivered':
      return '✅';
    case 'new_comment':
      return '💬';
    case 'comment_reply':
      return '↩️';
    default:
      return '🔔';
  }
};

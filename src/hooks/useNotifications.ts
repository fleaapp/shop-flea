import { useMemo, useCallback, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { preloadImages } from '@/utils/preloadAssets';

export type NotificationType = 
  | 'price_drop_cart'
  | 'price_drop_wishlist'
  | 'cart_item_sold'
  | 'wishlist_item_sold'
  | 'cart_wishlist_item_sold'
  | 'listing_sold'
  | 'new_review'
  | 'item_sold'
  | 'order_shipped'
  | 'order_delivered'
  | 'new_comment'
  | 'comment_reply'
  | 'mention'
  | 'shipping_reminder_3d'
  | 'shipping_reminder_6d'
  | 'order_message_seller'
  | 'order_message_buyer'
  | 'support_message';

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
      const combined = notificationsData.map(n => ({
        ...n,
        listing: n.related_listing_id ? listingsMap[n.related_listing_id] || null : null,
        related_user: n.related_user_id ? usersMap[n.related_user_id] || null : null,
      })) as Notification[];

      // Preload notification images (listing thumbnails + user avatars)
      const imagesToPreload = [
        ...Object.values(listingsMap).flatMap(l => l.images?.slice(0, 1) || []),
        ...Object.values(usersMap).map(u => u.avatar_url).filter(Boolean),
      ].filter(Boolean) as string[];
      if (imagesToPreload.length > 0) preloadImages(imagesToPreload);

      return combined;
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

  // Badge count: unread notifications created AFTER the last time
  // the user visited the Alerts screen. Green dots (is_read) are separate.
  const [badgeDismissedAt, setBadgeDismissedAt] = useState<string | null>(null);

  // Read from localStorage whenever user.id becomes available (including after re-login)
  useEffect(() => {
    if (user?.id) {
      setBadgeDismissedAt(localStorage.getItem(`flea_alerts_seen_${user.id}`));
    } else {
      setBadgeDismissedAt(null);
    }
  }, [user?.id]);

  // Sync across multiple hook instances via custom event
  useEffect(() => {
    const handler = () => {
      if (user?.id) {
        setBadgeDismissedAt(localStorage.getItem(`flea_alerts_seen_${user.id}`));
      }
    };
    window.addEventListener('alerts-badge-dismissed', handler);
    return () => window.removeEventListener('alerts-badge-dismissed', handler);
  }, [user?.id]);

  const badgeCount = useMemo(() => {
    if (!user?.id) return 0;
    if (!badgeDismissedAt) return notifications.length;
    const lastSeenDate = new Date(badgeDismissedAt);
    return notifications.filter(n => new Date(n.created_at) > lastSeenDate).length;
  }, [notifications, user?.id, badgeDismissedAt]);

  const dismissBadge = useCallback(() => {
    if (user?.id) {
      const now = new Date().toISOString();
      localStorage.setItem(`flea_alerts_seen_${user.id}`, now);
      setBadgeDismissedAt(now);
      window.dispatchEvent(new Event('alerts-badge-dismissed'));
    }
  }, [user?.id]);

  return {
    notifications,
    isLoading,
    unreadCount,
    badgeCount,
    markAsRead,
    markAllAsRead,
    dismissBadge,
  };
};

export const getNotificationMessage = (type: string, username?: string, listingTitle?: string | null): string => {
  // For comment notifications, use the message from the database which includes context
  if ((type === 'new_comment' || type === 'comment_reply') && listingTitle) {
    return listingTitle;
  }
  
  const displayUsername = username?.startsWith('@') ? username : username ? `@${username}` : undefined;
  
  switch (type) {
    case 'price_drop_cart':
      return 'Price dropped on an item in your cart!';
    case 'price_drop_wishlist':
      return 'Price dropped on an item in your wishlist!';
    case 'cart_item_sold':
      return listingTitle ? `Your cart's feeling lighter… ${listingTitle} in your cart just sold. 🛒🤷` : 'An item in your cart was sold.';
    case 'wishlist_item_sold':
      return listingTitle ? `Too slow… ${listingTitle} from your Wishlist just found a new home. 😢🏠` : 'An item in your wishlist was sold.';
    case 'cart_wishlist_item_sold':
      return listingTitle ? `Double heartbreak 💔 – ${listingTitle} from your Cart & Wishlist has sold.` : 'An item from your Cart & Wishlist has sold.';
    case 'listing_sold':
      // Legacy type from old trigger — use listing title if available
      return listingTitle ? `${listingTitle} has been sold.` : 'An item you saved was sold.';
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
    case 'shipping_reminder_3d':
      return '🚨 Reminder: Your buyer is waiting 👀 Ship now & update tracking. 📦';
    case 'shipping_reminder_6d':
      return '🚨 Urgent action: Your sale is 6 days overdue. Ship today to avoid issues. 🚚';
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
    case 'shipping_reminder_3d':
    case 'shipping_reminder_6d':
      return '🚨';
    default:
      return '🔔';
  }
};

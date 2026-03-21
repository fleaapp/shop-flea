import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getNotificationEmoji } from '@/hooks/useNotifications';

const ALERT_TITLES: Record<string, string> = {
  item_sold: '🎉 Item Sold!',
  order_shipped: '📦 Order Shipped',
  order_delivered: '🏠 Order Delivered',
  new_review: '⭐ New Review',
  new_comment: '💬 New Comment',
  comment_reply: '↩️ Reply',
  mention: '📣 Mentioned',
  shipping_reminder_3d: '🚨 Shipping Reminder',
  shipping_reminder_6d: '🚨 Urgent: Ship Now',
  order_message_seller: '💬 New Message',
  order_message_buyer: '📩 New Message',
  support_message: '🛎️ Support',
  refund_request: '🔄 Refund Requested',
  refund_rejected: '❌ Refund Rejected',
  refund_initiated: '✅ Refund Initiated',
  cart_item_sold: '🛒 Cart Item Sold',
  wishlist_item_sold: '😢 Wishlist Item Sold',
  cart_wishlist_item_sold: '💔 Item Sold',
};

const RealtimeAlerts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || subscribedRef.current) return;

    subscribedRef.current = true;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            type: string;
            title: string;
            message: string | null;
          };

          const emoji = getNotificationEmoji(notification.type);
          const title = ALERT_TITLES[notification.type] || `${emoji} ${notification.title}`;
          const description = notification.message?.slice(0, 80) || undefined;

          toast(title, {
            description,
            duration: 3500,
          });

          // Refresh notifications query
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      subscribedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return null;
};

export default RealtimeAlerts;

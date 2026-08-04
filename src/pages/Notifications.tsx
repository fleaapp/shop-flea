import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import GuestPromptInline from '@/components/GuestPromptInline';
import { useAuth } from '@/context/AuthContext';
import { useNotifications, getNotificationMessage, getNotificationEmoji, Notification } from '@/hooks/useNotifications';
import { useOrders } from '@/hooks/useOrders';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { canOpenListing } from '@/utils/listingAccess';
import { supabase } from '@/integrations/supabase/client';


import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import OrderDetailsSheet from '@/components/OrderDetailsSheet';
import EnablePushBanner from '@/components/EnablePushBanner';
import { OrderGroup } from '@/hooks/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import { clearOrderChatBadges } from '@/utils/orderChatRead';
import EmptyState from '@/components/EmptyState';


const ProductThumbnail = ({
  image,
  avatar,
  fallbackEmoji
}: {
  image: string;
  avatar?: string;
  fallbackEmoji?: string;
}) => (
  <div className="relative h-20 w-20 flex-shrink-0">
    {image ? (
      <img 
        src={image} 
        alt="Product" 
        className="h-full w-full rounded-xl object-cover" 
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.classList.add('bg-muted', 'flex', 'items-center', 'justify-center', 'rounded-xl');
          const emoji = document.createElement('span');
          emoji.className = 'text-3xl';
          emoji.textContent = fallbackEmoji || '✈️';
          e.currentTarget.parentElement?.appendChild(emoji);
        }}
      />
    ) : (
      <div className="h-full w-full rounded-xl bg-muted flex items-center justify-center">
        <span className="text-3xl">{fallbackEmoji || '✈️'}</span>
      </div>
    )}
    {avatar && (
      <img src={avatar} alt="User" className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 border-card object-cover" />
    )}
  </div>
);

const UnreadIndicator = () => (
  <div className="w-2.5 h-2.5 rounded-full bg-[hsl(82,84%,55%)] flex-shrink-0" />
);

const Notifications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isUnauthed = !user;
  const { sellerOrderGroups, buyerOrderGroups, markAsShipped, markAsDelivered, completeOrder } = useOrders();
  const { notifications, isLoading: loadingNotifications, unreadCount, badgeCount, markAsRead, markAllAsRead } = useNotifications();
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const [selectedBuyerGroup, setSelectedBuyerGroup] = useState<OrderGroup | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  const autoOpenedRef = useRef<string | null>(null);


  const findGroup = (n: Notification, groups: OrderGroup[]): OrderGroup | null => {
    if (n.related_order_id) {
      const byGroup = groups.find(
        g => (g.order_group_id || g.id) === n.related_order_id
          || g.orders.some(o => o.id === n.related_order_id)
      );
      if (byGroup) return byGroup;
    }
    if (n.related_listing_id) {
      const byListing = groups.find(g => g.orders.some(o => o.listing_id === n.related_listing_id));
      if (byListing) return byListing;
    }
    return null;
  };

  const openOrderMessageChat = (group: OrderGroup | null, fallbackThreadId: string | null) => {
    const threadId = group?.order_group_id || group?.orders[0]?.id || fallbackThreadId;
    if (!threadId) return false;
    if (user?.id) {
      const role = group
        ? user.id === group.buyer_id ? 'buyer' : user.id === group.seller_id ? 'seller' : 'unknown'
        : 'unknown';
      clearOrderChatBadges({
        queryClient,
        userId: user.id,
        threadId,
        orderIds: group?.orders.map((order) => order.id) ?? (fallbackThreadId ? [fallbackThreadId] : []),
        role,
      });
    }
    navigate(`/order-chat/${threadId}`);
    return true;
  };

  // Mark all unread notifications as read on open — this also clears the
  // bottom-nav badge (both are derived from `is_read` in the DB now).
  useEffect(() => {
    if (loadingNotifications) return;
    if (!notifications.some(n => !n.is_read)) return;
    markAllAsRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingNotifications]);

  // Auto-open the target notification when arriving from a push tap
  // (`/notifications?open=<type>&order=<id>&listing=<id>&thread=<id>`). We wait
  // until notifications and order groups have loaded, then replay the same
  // click handler the user would fire by tapping the row — so the correct
  // drawer/chat/listing opens. The params are stripped afterwards so a
  // refresh doesn't re-trigger.
  useEffect(() => {
    if (loadingNotifications) return;
    const params = new URLSearchParams(location.search);
    const openType = params.get('open');
    if (!openType) return;
    const orderId = params.get('order');
    const listingId = params.get('listing');
    const threadId = params.get('thread');
    const key = `${openType}|${orderId ?? ''}|${listingId ?? ''}|${threadId ?? ''}`;
    if (autoOpenedRef.current === key) return;

    const match = notifications.find((n) => {
      if (n.type !== openType) return false;
      if (orderId && n.related_order_id !== orderId) return false;
      if (listingId && n.related_listing_id !== listingId) return false;
      if (threadId && n.related_thread_id !== threadId) return false;
      return true;
    });

    if (!match) {
      // Order groups may not be ready yet on cold start; retry after they load
      // by leaving the params in place. Only mark as handled once matched.
      return;
    }

    autoOpenedRef.current = key;
    void handleNotificationClick(match);
    // Strip the query params without a new history entry.
    try {
      window.history.replaceState(null, '', '/notifications');
    } catch {
      // no-op
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingNotifications, notifications, sellerOrderGroups, buyerOrderGroups, location.search]);




  const handleNotificationClick = async (notification: Notification) => {
    if (notification.id.startsWith('fallback-')) {
      if (notification.related_thread_id) {
        await (supabase as any)
          .from('chat_messages')
          .update({ read: true })
          .eq('thread_id', notification.related_thread_id)
          .neq('sender_type', 'user')
          .eq('read', false);
      }
    } else if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }

    
    // Shipping reminders → navigate to sales page
    if (notification.type === 'shipping_reminder_3d' || notification.type === 'shipping_reminder_6d') {
      if (notification.related_listing_id) {
        const matchingGroup = sellerOrderGroups.find(g =>
          g.orders.some(o => o.listing_id === notification.related_listing_id)
        );
        if (matchingGroup) {
          setHighlightOrderId(matchingGroup.orders.find(o => o.listing_id === notification.related_listing_id)?.id ?? null);
          setSelectedGroup(matchingGroup);
          setSaleSheetOpen(true);
          return;
        }
      }
      navigate('/sales');
      return;
    }

    // Sale-side alerts (seller) → open Sale Details drawer
    if (
      notification.type === 'item_sold' ||
      notification.type === 'sale_delivered' ||
      notification.type === 'refund_request' ||
      notification.type === 'sale_auto_refunded'
    ) {
      const matchingGroup = findGroup(notification, sellerOrderGroups);
      if (matchingGroup) {
        setSelectedGroup(matchingGroup);
        setHighlightOrderId(notification.related_order_id ?? null);
        setSaleSheetOpen(true);
        return;
      }
      navigate('/sales');
      return;
    }


    // Order-side alerts (buyer) → open Order Details drawer
    if (
      notification.type === 'order_shipped' ||
      notification.type === 'order_delivered' ||
      notification.type === 'refund_initiated' ||
      notification.type === 'refund_rejected' ||
      notification.type === 'order_auto_refunded'
    ) {
      const matchingGroup = findGroup(notification, buyerOrderGroups);
      if (matchingGroup) {
        setSelectedBuyerGroup(matchingGroup);
        setHighlightOrderId(notification.related_order_id ?? null);
        setOrderSheetOpen(true);
        return;
      }
      navigate('/cart');
      return;
    }


    // Message notifications → still go to the chat
    if (notification.type === 'order_message_seller' || notification.type === 'order_message_buyer') {
      const allGroups = [...(sellerOrderGroups || []), ...(buyerOrderGroups || [])];
      const matchingByOrder = findGroup(notification, allGroups);
      if (openOrderMessageChat(matchingByOrder, notification.related_order_id)) return;
      if (notification.related_listing_id) {
        const matchingGroup = allGroups.find((group) =>
          group.orders.some((order) => order.listing_id === notification.related_listing_id)
        );
        if (matchingGroup) {
          if (openOrderMessageChat(matchingGroup, null)) return;
        }
      }
      navigate('/cart');
      return;
    }

    // Support message → navigate to the relevant support thread
    if (notification.type === 'support_message') {
      if (notification.related_thread_id) {
        navigate(`/contact-support/${notification.related_thread_id}`);
        return;
      }
      navigate('/contact-support');
      return;
    }

    // Payment action required → open Seller Dashboard in-app
    if (notification.type === 'payment_action_required') {
      navigate('/seller-dashboard');
      return;
    }

    // New review → open own profile with the Reviews drawer open
    if (notification.type === 'new_review') {
      navigate('/profile', { state: { openReviews: true } });
      return;
    }

    // Accepted offer about to lapse → send them straight to the cart to pay
    if (notification.type === 'offer_expiring') {
      navigate('/cart');
      return;
    }

    // Offer activity → open the Offers screen on the right tab
    if (notification.type?.startsWith('offer_')) {
      const sentTab =
        notification.type === 'offer_accepted' ||
        notification.type === 'offer_declined' ||
        notification.type === 'offer_withdrawn' ||
        notification.type === 'offer_cancelled' ||
        notification.type === 'offer_superseded';
      navigate('/offers', { state: { tab: sentTab ? 'sent' : 'received', role: 'auto' } });
      return;
    }



    // Navigate based on notification type (comments, mentions, wishlist/cart sold, etc.)
    if (notification.related_listing_id) {
      const listingIsAccessible = await canOpenListing(notification.related_listing_id);
      if (!listingIsAccessible) {
        toast.error('This listing is no longer available.');
        return;
      }
      navigate(`/listing/${notification.related_listing_id}`);
    }
  };

  const handleMarkShipped = (trackingDetails: { serviceProvider: string; trackingNumber: string }) => {
    if (!selectedGroup) return;
    if (selectedGroup.order_group_id) {
      markAsShipped.mutate({
        orderGroupId: selectedGroup.order_group_id,
        trackingProvider: trackingDetails.serviceProvider,
        trackingNumber: trackingDetails.trackingNumber,
      });
    } else {
      markAsShipped.mutate({
        orderId: selectedGroup.orders[0].id,
        trackingProvider: trackingDetails.serviceProvider,
        trackingNumber: trackingDetails.trackingNumber,
      });
    }
    setSaleSheetOpen(false);
    setSelectedGroup(null);
  };

  const handleMarkDelivered = () => {
    if (!selectedBuyerGroup) return;
    if (selectedBuyerGroup.order_group_id) {
      markAsDelivered.mutate({ orderGroupId: selectedBuyerGroup.order_group_id });
    } else {
      markAsDelivered.mutate(selectedBuyerGroup.orders[0].id);
    }
    setOrderSheetOpen(false);
    setSelectedBuyerGroup(null);
  };

  const handleCompleteOrder = () => {
    if (!selectedBuyerGroup) return;
    if (selectedBuyerGroup.order_group_id) {
      completeOrder.mutate({ orderGroupId: selectedBuyerGroup.order_group_id });
    } else {
      completeOrder.mutate({ orderId: selectedBuyerGroup.orders[0].id });
    }
    setOrderSheetOpen(false);
    setSelectedBuyerGroup(null);
  };


  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const NotificationCard = ({ notification }: { notification: Notification }) => {
    const listingImage = notification.listing?.images?.[0] || '';
    const userAvatar = notification.related_user?.avatar_url || (notification.related_user_id ? getDefaultAvatar(notification.related_user_id) : undefined);
    const username = notification.related_user?.username;
    const emoji = getNotificationEmoji(notification.type as any);
    const itemName = notification.listing?.title || null;
    const isUrgent = notification.type === 'shipping_reminder_6d';

    const isSoldOrLegacy = ['cart_item_sold', 'wishlist_item_sold', 'cart_wishlist_item_sold', 'listing_sold'].includes(notification.type);
    const isCommentType = ['new_comment', 'comment_reply'].includes(notification.type);
    const isShippingReminder = ['shipping_reminder_3d', 'shipping_reminder_6d'].includes(notification.type);
    const isMessageType = notification.type.startsWith('offer_') || ['order_message_seller', 'order_message_buyer', 'support_message', 'order_shipped', 'order_delivered', 'sale_delivered', 'refund_request', 'refund_rejected', 'refund_initiated', 'order_auto_refunded', 'sale_auto_refunded'].includes(notification.type);
    const messageArg = isSoldOrLegacy ? itemName : isCommentType ? notification.message : isShippingReminder ? null : itemName;
    const message = getNotificationMessage(notification.type as any, username, messageArg, isMessageType ? notification.message : null);

    const renderMessage = () => {
      const boldUsernames = (text: string) => {
        const parts = text.split(/(@\w+)/g);
        if (parts.length === 1) return text;
        return parts.map((part, i) =>
          part.startsWith('@') ? <span key={i} className="font-bold">{part}</span> : part
        );
      };

      if (isSoldOrLegacy && itemName && message.includes(itemName)) {
        const parts = message.split(itemName);
        return (
          <>
            {boldUsernames(parts[0])}<span className="font-bold">{itemName}</span>{parts.slice(1).map(p => boldUsernames(p))}
          </>
        );
      }
      return boldUsernames(message);
    };

    return (
      <div 
        onClick={() => handleNotificationClick(notification)}
        className="relative flex items-start gap-4 rounded-2xl bg-card p-4 cursor-pointer"
      >
        <ProductThumbnail image={listingImage} avatar={userAvatar} fallbackEmoji={emoji} />
        <div className="flex-1 min-w-0 pb-5 pr-10">
          <p className="text-sm text-foreground pt-2 notification-text">
            {isUrgent && message.includes('Urgent action:') ? (
              <>
                {message.split('Urgent action:')[0]}
                <span className="font-bold text-destructive">Urgent action:</span>
                {message.split('Urgent action:').slice(1).join('Urgent action:')}
              </>
            ) : notification.type === 'shipping_reminder_3d' && message.includes('Reminder:') ? (
              <>
                {message.split('Reminder:')[0]}
                <span className="font-bold">Reminder:</span>
                {message.split('Reminder:').slice(1).join('Reminder:')}
              </>
            ) : renderMessage()}
          </p>
        </div>
        <div className="absolute bottom-4 right-4">
          <p className="text-xs text-muted-foreground">{formatTime(notification.created_at)}</p>
        </div>
        {!notification.is_read && (
          <div className="absolute top-4 right-4">
            <UnreadIndicator />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="flex justify-center pt-8 pb-6">
          <h1 className="text-xl font-bold text-foreground">🔔 Alerts</h1>
        </div>
      </div>


      {/* Content */}
      <div className="px-4 space-y-3">
        {!isUnauthed && <EnablePushBanner />}
        {isUnauthed ? (
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <GuestPromptInline />
          </div>
        ) : loadingNotifications ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <span className="text-5xl mb-4">⏳</span>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            emoji="🔔"
            title="No notifications yet"
            description="Your activity will appear here"
            minHeightClass="min-h-[60vh]"
          />
        ) : (
          notifications.map(notification => (
            <NotificationCard key={notification.id} notification={notification} />
          ))
        )}
      </div>


      <SalesDetailsSheet
        orders={selectedGroup?.orders ?? null}
        open={saleSheetOpen}
        onOpenChange={(open) => { setSaleSheetOpen(open); if (!open) { setSelectedGroup(null); setHighlightOrderId(null); } }}
        onMarkShipped={handleMarkShipped}
        highlightOrderId={highlightOrderId}
      />

      <OrderDetailsSheet
        orders={selectedBuyerGroup?.orders ?? null}
        open={orderSheetOpen}
        onOpenChange={(open) => { setOrderSheetOpen(open); if (!open) { setSelectedBuyerGroup(null); setHighlightOrderId(null); } }}
        onMarkDelivered={handleMarkDelivered}
        onCompleteOrder={handleCompleteOrder}
        highlightOrderId={highlightOrderId}
      />

      </div>

      <BottomNav />
    </div>
  );
};


export default Notifications;

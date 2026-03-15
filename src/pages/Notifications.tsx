import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { useNotifications, getNotificationMessage, getNotificationEmoji, Notification } from '@/hooks/useNotifications';
import { useOrders } from '@/hooks/useOrders';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { canOpenListing } from '@/utils/listingAccess';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import { OrderGroup } from '@/hooks/useOrders';

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
          emoji.textContent = fallbackEmoji || '📦';
          e.currentTarget.parentElement?.appendChild(emoji);
        }}
      />
    ) : (
      <div className="h-full w-full rounded-xl bg-muted flex items-center justify-center">
        <span className="text-3xl">{fallbackEmoji || '📦'}</span>
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
  const { sellerOrderGroups, markAsShipped } = useOrders();
  const { notifications, isLoading: loadingNotifications, unreadCount, badgeCount, markAsRead, dismissBadge } = useNotifications();
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);

  // Dismiss the nav badge when the screen is viewed
  useEffect(() => {
    dismissBadge();
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    
    // Shipping reminders → navigate to sales page
    if (notification.type === 'shipping_reminder_3d' || notification.type === 'shipping_reminder_6d') {
      if (notification.related_listing_id) {
        const matchingGroup = sellerOrderGroups.find(g =>
          g.orders.some(o => o.listing_id === notification.related_listing_id)
        );
        if (matchingGroup) {
          setSelectedGroup(matchingGroup);
          setSaleSheetOpen(true);
          return;
        }
      }
      navigate('/sales');
      return;
    }

    // Item sold → navigate to sales
    if (notification.type === 'item_sold') {
      navigate('/sales');
      return;
    }

    // Order message notifications → navigate to order chat
    if ((notification.type === 'order_message_seller' || notification.type === 'order_message_buyer') && notification.related_order_id) {
      navigate(`/order-chat/${notification.related_order_id}`);
      return;
    }

    // Support message → navigate to support thread
    if (notification.type === 'support_message' && notification.related_thread_id) {
      navigate(`/contact-support/${notification.related_thread_id}`);
      return;
    }
    if (notification.type === 'support_message') {
      navigate('/contact-support');
      return;
    }

    // Order shipped/delivered → navigate to cart (orders tab)
    if (notification.type === 'order_shipped' || notification.type === 'order_delivered') {
      navigate('/cart');
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
    const isMessageType = ['order_message_seller', 'order_message_buyer', 'support_message', 'order_shipped', 'order_delivered'].includes(notification.type);
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="flex justify-center pt-8 pb-6">
          <h1 className="text-xl font-bold text-foreground">🔔 Alerts</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-3">
        {loadingNotifications ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <span className="text-5xl mb-4">⏳</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <span className="text-6xl opacity-50 mb-4">🔔</span>
            <p className="text-lg font-medium text-muted-foreground">No notifications yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Your activity will appear here</p>
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationCard key={notification.id} notification={notification} />
          ))
        )}
      </div>

      <SalesDetailsSheet
        orders={selectedGroup?.orders ?? null}
        open={saleSheetOpen}
        onOpenChange={(open) => { setSaleSheetOpen(open); if (!open) setSelectedGroup(null); }}
        onMarkShipped={handleMarkShipped}
      />

      <BottomNav />
    </div>
  );
};

export default Notifications;

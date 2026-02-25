import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import BottomNav from '@/components/BottomNav';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import { useOrders, Order, OrderGroup } from '@/hooks/useOrders';
import { useNotifications, getNotificationMessage, getNotificationEmoji, Notification } from '@/hooks/useNotifications';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const getStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'awaiting':
      return {
        label: 'Awaiting shipping',
        className: 'bg-accent text-accent-foreground'
      };
    case 'shipped':
      return {
        label: 'Shipped',
        className: 'bg-muted text-muted-foreground'
      };
    case 'delivered':
      return {
        label: 'Delivered',
        className: 'bg-muted text-muted-foreground'
      };
  }
};

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
  const [activeTab, setActiveTab] = useState<'activity' | 'sales'>('activity');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'awaiting' | 'shipped' | 'delivered'>('awaiting');
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const { sellerOrderGroups, loadingSellerOrders, markAsShipped } = useOrders();
  const { notifications, isLoading: loadingNotifications, unreadCount, badgeCount, markAsRead, dismissBadge } = useNotifications();
  const { getGroupUnread } = useUnreadOrderMessages();

  // Dismiss the nav badge when the Activity tab is viewed, but keep green dots
  useEffect(() => {
    if (activeTab === 'activity') {
      dismissBadge();
    }
  }, [activeTab]);
  
  // Filter sales by status
  const awaitingShipping = sellerOrderGroups.filter(g => g.status === 'awaiting');
  const shipped = sellerOrderGroups.filter(g => g.status === 'shipped');
  const delivered = sellerOrderGroups.filter(g => g.status === 'delivered');
  
  // Sales badge: awaiting + shipped (not delivered)
  const salesBadgeCount = awaitingShipping.length + shipped.length;

  const handleSaleClick = (group: OrderGroup) => {
    setSelectedGroup(group);
    setSaleSheetOpen(true);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    
    // Shipping reminders → switch to sales tab and open the relevant order
    if (notification.type === 'shipping_reminder_3d' || notification.type === 'shipping_reminder_6d') {
      setActiveTab('sales');
      if (notification.related_listing_id) {
        const matchingGroup = sellerOrderGroups.find(g =>
          g.orders.some(o => o.listing_id === notification.related_listing_id)
        );
        if (matchingGroup) {
          setSelectedGroup(matchingGroup);
          setSaleSheetOpen(true);
        }
      }
      return;
    }

    // Navigate based on notification type
    if (notification.related_listing_id) {
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

  const SaleCard = ({ group, showShadow = false }: { group: OrderGroup; showShadow?: boolean }) => {
    const primaryOrder = group.orders[0];
    const rawBuyerUsername = primaryOrder.buyer_profile?.username || 'Unknown';
    const buyerUsername = rawBuyerUsername.startsWith('@') ? rawBuyerUsername.slice(1) : rawBuyerUsername;
    const buyerAvatar = primaryOrder.buyer_profile?.avatar_url || '';
    const productImage = primaryOrder.listing?.images?.[0] || '';
    const itemCount = group.orders.length;
    const unread = group.orders.reduce((sum, o) => sum + getGroupUnread(o.id), 0);

    return (
      <div 
        onClick={() => handleSaleClick(group)}
        className={cn(
          "flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer",
          showShadow && "card-shadow"
        )}
      >
        <ProductThumbnail image={productImage} avatar={buyerAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            Sold to <span className="font-semibold">@{buyerUsername}</span>
            {itemCount > 1 ? <span className="text-muted-foreground"> • {itemCount} items</span> : null}.
          </p>
          <p className="text-xs text-muted-foreground">{formatTime(group.created_at)}</p>
          <span className={cn('mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium', getStatusBadge(group.status).className)}>
            {getStatusBadge(group.status).label}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/order-chat/${primaryOrder.id}`);
          }}
          className="relative flex h-10 w-10 items-center justify-center flex-shrink-0"
        >
          <span className="text-xl">💬</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </button>
      </div>
    );
  };

  const NotificationCard = ({ notification }: { notification: Notification }) => {
    const listingImage = notification.listing?.images?.[0] || '';
    const userAvatar = notification.related_user?.avatar_url || (notification.related_user_id ? getDefaultAvatar(notification.related_user_id) : undefined);
    const username = notification.related_user?.username;
    const emoji = getNotificationEmoji(notification.type as any);
    const itemName = notification.listing?.title || null;
    const isUrgent = notification.type === 'shipping_reminder_6d';

    // For sold-type and legacy notifications, use the listing title from joined data (not the raw message column)
    // For comment notifications, pass the raw message (which contains the formatted comment text)
    // For shipping reminders, use the fixed message from the helper
    const isSoldOrLegacy = ['cart_item_sold', 'wishlist_item_sold', 'cart_wishlist_item_sold', 'listing_sold'].includes(notification.type);
    const isCommentType = ['new_comment', 'comment_reply'].includes(notification.type);
    const isShippingReminder = ['shipping_reminder_3d', 'shipping_reminder_6d'].includes(notification.type);
    const messageArg = isSoldOrLegacy ? itemName : isCommentType ? notification.message : isShippingReminder ? null : itemName;
    const message = getNotificationMessage(notification.type as any, username, messageArg);

    const renderMessage = () => {
      // Bold usernames (@username) in the message
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
          <p className="text-xs text-muted-foreground">
            {formatTime(notification.created_at)}
          </p>
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
      {/* Sticky Header with Tab Switcher */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="flex justify-center pt-8 pb-6">
          <div className="flex items-center rounded-full bg-muted p-1">
            <button 
              onClick={() => setActiveTab('activity')} 
              className={cn(
                'relative flex items-center justify-center gap-2 rounded-full w-28 py-2.5 text-sm font-medium transition-all', 
                activeTab === 'activity' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <span className="text-base">🔔</span>
              Activity
              {activeTab !== 'activity' && badgeCount > 0 && (
                <span className="absolute -top-1 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {badgeCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('sales')} 
              className={cn(
                'relative flex items-center justify-center gap-2 rounded-full w-28 py-2.5 text-sm font-medium transition-all', 
                activeTab === 'sales' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <span className="text-base">💸</span>
              Sales
              {activeTab !== 'sales' && salesBadgeCount > 0 && (
                <span className="absolute -top-1 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {salesBadgeCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status segmented toggle for sales */}
      {activeTab === 'sales' && (
        <div className="flex justify-center px-4 pb-4">
          <div className="inline-flex items-center rounded-full bg-muted p-1">
            {([
              { key: 'awaiting' as const, label: 'To Ship' },
              { key: 'shipped' as const, label: 'Shipped' },
              { key: 'delivered' as const, label: 'Delivered' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSalesStatusFilter(key)}
                className={cn(
                  'rounded-full w-24 py-2 text-sm font-medium transition-all',
                  salesStatusFilter === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 space-y-3">
        {activeTab === 'activity' ? (
          <>
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
          </>
        ) : (
          <>
            {loadingSellerOrders ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <span className="text-5xl mb-4">⏳</span>
              </div>
            ) : (() => {
              const filteredSales = sellerOrderGroups.filter(g => g.status === salesStatusFilter);
              if (filteredSales.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                    <span className="text-6xl opacity-50 mb-4">💸</span>
                    <p className="text-lg font-medium text-muted-foreground">
                      {salesStatusFilter === 'awaiting' && 'No sales to ship yet'}
                      {salesStatusFilter === 'shipped' && 'No shipped sales yet'}
                      {salesStatusFilter === 'delivered' && 'No delivered sales yet'}
                    </p>
                  </div>
                );
              }

              if (salesStatusFilter === 'awaiting') {
                const now = Date.now();
                const FOUR_DAYS = 4 * 24 * 60 * 60 * 1000;
                const overdue = filteredSales.filter((g) => now - new Date(g.created_at).getTime() >= FOUR_DAYS);
                const onTime = filteredSales.filter((g) => now - new Date(g.created_at).getTime() < FOUR_DAYS);

                return (
                  <div className="space-y-6">
                    {overdue.length > 0 && (
                      <div>
                        <h2 className="mb-3 text-base font-semibold text-destructive">🚨 Overdue</h2>
                        <div className="space-y-3">
                          {overdue.map(group => (
                            <SaleCard key={group.id} group={group} showShadow />
                          ))}
                        </div>
                      </div>
                    )}
                    {onTime.length > 0 && (
                      <div>
                        {overdue.length > 0 && (
                          <h2 className="mb-3 text-base font-semibold text-foreground">Awaiting Shipping</h2>
                        )}
                        <div className="space-y-3">
                          {onTime.map(group => (
                            <SaleCard key={group.id} group={group} showShadow />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filteredSales.map(group => (
                    <SaleCard key={group.id} group={group} showShadow={false} />
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Sales Details Sheet */}
      <SalesDetailsSheet
        orders={selectedGroup?.orders ?? null}
        open={saleSheetOpen}
        onOpenChange={(open) => {
          setSaleSheetOpen(open);
          if (!open) setSelectedGroup(null);
        }}
        onMarkShipped={handleMarkShipped}
      />

      <BottomNav />
    </div>
  );
};

export default Notifications;

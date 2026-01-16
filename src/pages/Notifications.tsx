import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import { useOrders, Order } from '@/hooks/useOrders';
import { useNotifications, getNotificationMessage, getNotificationEmoji, Notification } from '@/hooks/useNotifications';
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
  const [activeTab, setActiveTab] = useState<'activity' | 'sales'>('activity');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const { sellerOrders, loadingSellerOrders, markAsShipped } = useOrders();
  const { notifications, isLoading: loadingNotifications, unreadCount, markAsRead } = useNotifications();
  
  // Filter sales by status
  const awaitingShipping = sellerOrders.filter(o => o.status === 'awaiting');
  const shipped = sellerOrders.filter(o => o.status === 'shipped');
  const delivered = sellerOrders.filter(o => o.status === 'delivered');
  
  const awaitingCount = awaitingShipping.length;

  const handleSaleClick = (order: Order) => {
    setSelectedOrder(order);
    setSaleSheetOpen(true);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    // Future: Navigate to related content based on type
  };

  const handleMarkShipped = (trackingDetails: { serviceProvider: string; trackingNumber: string }) => {
    if (selectedOrder) {
      markAsShipped.mutate({
        orderId: selectedOrder.id,
        trackingProvider: trackingDetails.serviceProvider,
        trackingNumber: trackingDetails.trackingNumber,
      });
      setSaleSheetOpen(false);
      setSelectedOrder(null);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const SaleCard = ({ order, showShadow = false }: { order: Order; showShadow?: boolean }) => {
    const buyerUsername = order.buyer_profile?.username || 'Unknown';
    const buyerAvatar = order.buyer_profile?.avatar_url || '';
    const productImage = order.listing?.images?.[0] || '';

    return (
      <div 
        onClick={() => handleSaleClick(order)}
        className={cn(
          "flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer",
          showShadow && "card-shadow"
        )}
      >
        <ProductThumbnail image={productImage} avatar={buyerAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            Sold to <span className="font-semibold">@{buyerUsername}.</span>
          </p>
          <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
          <span className={cn('mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium', getStatusBadge(order.status).className)}>
            {getStatusBadge(order.status).label}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
    );
  };

  const NotificationCard = ({ notification }: { notification: Notification }) => {
    const listingImage = notification.listing?.images?.[0] || '';
    const userAvatar = notification.related_user?.avatar_url || undefined;
    const username = notification.related_user?.username;
    const emoji = getNotificationEmoji(notification.type as any);
    const message = getNotificationMessage(notification.type as any, username);

    return (
      <div 
        onClick={() => handleNotificationClick(notification)}
        className="relative flex items-start gap-4 rounded-2xl bg-card p-4 cursor-pointer"
      >
        <ProductThumbnail image={listingImage} avatar={userAvatar} fallbackEmoji={emoji} />

        <div className="flex-1 min-w-0 pb-5 pr-10">
          <p className="text-sm font-semibold text-foreground pt-2">{message}</p>
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
              {activeTab !== 'activity' && unreadCount > 0 && (
                <span className="absolute -top-1 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
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
              {activeTab !== 'sales' && awaitingCount > 0 && (
                <span className="absolute -top-1 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {awaitingCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-3">
        {activeTab === 'activity' ? (
          <>
            {loadingNotifications ? (
              <div className="flex justify-center py-10">
                <p className="text-muted-foreground">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
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
              <div className="flex justify-center py-10">
                <p className="text-muted-foreground">Loading sales...</p>
              </div>
            ) : sellerOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-6xl opacity-50 mb-4">💸</span>
                <p className="text-lg font-medium text-muted-foreground">No sales yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Your sales will appear here</p>
              </div>
            ) : (
              <>
                {/* Awaiting Shipping */}
                {awaitingShipping.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-base font-semibold text-foreground">Awaiting shipping</h2>
                    <div className="space-y-3">
                      {awaitingShipping.map(order => (
                        <SaleCard key={order.id} order={order} showShadow />
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipped */}
                {shipped.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-base font-semibold text-foreground">Shipped</h2>
                    <div className="space-y-3">
                      {shipped.map(order => (
                        <SaleCard key={order.id} order={order} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivered */}
                {delivered.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-base font-semibold text-foreground">Delivered</h2>
                    <div className="space-y-3">
                      {delivered.map(order => (
                        <SaleCard key={order.id} order={order} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Sales Details Sheet */}
      <SalesDetailsSheet
        order={selectedOrder}
        open={saleSheetOpen}
        onOpenChange={setSaleSheetOpen}
        onMarkShipped={handleMarkShipped}
      />

      <BottomNav />
    </div>
  );
};

export default Notifications;

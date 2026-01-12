import { useState } from 'react';
import { Bell, PartyPopper, ChevronRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import { useOrders, Order } from '@/hooks/useOrders';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type ActivityNotification = {
  id: string;
  type: 'comment' | 'reply' | 'review';
  username: string;
  productImage: string;
  userAvatar: string;
  time: string;
  read: boolean;
};

// Keep activity notifications as mock data for now
import listingJacket from '@/assets/listing-jacket.jpg';
import listingSneakers from '@/assets/listing-sneakers.jpg';
import listingSweater from '@/assets/listing-sweater.jpg';
import listingBag from '@/assets/listing-bag.jpg';

const activityNotifications: ActivityNotification[] = [{
  id: '1',
  type: 'comment',
  username: 'sarah_m',
  productImage: listingJacket,
  userAvatar: 'https://i.pravatar.cc/40?img=1',
  time: '24 minutes ago',
  read: false
}, {
  id: '2',
  type: 'reply',
  username: 'mike_jones',
  productImage: listingSweater,
  userAvatar: 'https://i.pravatar.cc/40?img=2',
  time: '2 hours ago',
  read: false
}, {
  id: '3',
  type: 'review',
  username: 'emma_style',
  productImage: listingSneakers,
  userAvatar: 'https://i.pravatar.cc/40?img=3',
  time: '10 hours ago',
  read: false
}, {
  id: '4',
  type: 'comment',
  username: 'alex_vintage',
  productImage: listingSneakers,
  userAvatar: 'https://i.pravatar.cc/40?img=4',
  time: '25/2/2025',
  read: true
}, {
  id: '5',
  type: 'reply',
  username: 'fashion_lover',
  productImage: listingBag,
  userAvatar: 'https://i.pravatar.cc/40?img=5',
  time: '17/12/2024',
  read: true
}, {
  id: '6',
  type: 'review',
  username: 'closet_clean',
  productImage: listingJacket,
  userAvatar: 'https://i.pravatar.cc/40?img=6',
  time: '5/4/2024',
  read: true
}];

const getActivityMessage = (type: ActivityNotification['type']) => {
  switch (type) {
    case 'comment':
      return 'commented on your listing.';
    case 'reply':
      return 'replied to your comment on their listing.';
    case 'review':
      return 'left you a review.';
  }
};

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
  avatar
}: {
  image: string;
  avatar: string;
}) => (
  <div className="relative h-20 w-20 flex-shrink-0">
    <img src={image} alt="Product" className="h-full w-full rounded-xl object-cover" />
    <img src={avatar} alt="User" className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 border-card object-cover" />
  </div>
);

const Notifications = () => {
  const [activeTab, setActiveTab] = useState<'activity' | 'sales'>('activity');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const { sellerOrders, loadingSellerOrders, markAsShipped } = useOrders();

  const unreadNotifications = activityNotifications.filter(n => !n.read);
  const readNotifications = activityNotifications.filter(n => n.read);
  
  // Filter sales by status
  const awaitingShipping = sellerOrders.filter(o => o.status === 'awaiting');
  const shipped = sellerOrders.filter(o => o.status === 'shipped');
  const delivered = sellerOrders.filter(o => o.status === 'delivered');
  
  const unreadCount = unreadNotifications.length;
  const awaitingCount = awaitingShipping.length;

  const handleSaleClick = (order: Order) => {
    setSelectedOrder(order);
    setSaleSheetOpen(true);
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

  const formatOrderTime = (dateString: string) => {
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
          <p className="text-xs text-muted-foreground">{formatOrderTime(order.created_at)}</p>
          <span className={cn('mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium', getStatusBadge(order.status).className)}>
            {getStatusBadge(order.status).label}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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
              <Bell className="h-4 w-4" />
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
              <PartyPopper className="h-4 w-4" />
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
      <div className="px-4 space-y-6">
        {activeTab === 'activity' ? (
          <>
            {/* Unread Section */}
            {unreadNotifications.length > 0 && (
              <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Unread</h2>
                <div className="space-y-3">
                  {unreadNotifications.map(notification => (
                    <div key={notification.id} className="flex gap-4 rounded-2xl bg-card p-4 card-shadow cursor-pointer">
                      <ProductThumbnail image={notification.productImage} avatar={notification.userAvatar} />
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">@{notification.username}</span>{' '}
                          {getActivityMessage(notification.type)}
                        </p>
                        <p className="text-xs text-muted-foreground text-right mt-auto">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Read Section */}
            {readNotifications.length > 0 && (
              <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Read</h2>
                <div className="space-y-3">
                  {readNotifications.map(notification => (
                    <div key={notification.id} className="flex gap-4 rounded-2xl bg-card p-4 cursor-pointer opacity-80">
                      <ProductThumbnail image={notification.productImage} avatar={notification.userAvatar} />
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">@{notification.username}</span>{' '}
                          {getActivityMessage(notification.type)}
                        </p>
                        <p className="text-xs text-muted-foreground text-right mt-auto">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
                <PartyPopper className="h-16 w-16 text-muted-foreground/50 mb-4" />
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

import { useState } from 'react';
import { Bell, PartyPopper, ChevronRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { cn } from '@/lib/utils';

import listingJacket from '@/assets/listing-jacket.jpg';
import listingSneakers from '@/assets/listing-sneakers.jpg';
import listingSweater from '@/assets/listing-sweater.jpg';
import listingBag from '@/assets/listing-bag.jpg';

type ActivityNotification = {
  id: string;
  type: 'comment' | 'reply' | 'review';
  username: string;
  productImage: string;
  userAvatar: string;
  time: string;
  read: boolean;
};

type SaleNotification = {
  id: string;
  username: string;
  productImage: string;
  userAvatar: string;
  time: string;
  status: 'awaiting' | 'shipped' | 'delivered';
};

const activityNotifications: ActivityNotification[] = [
  {
    id: '1',
    type: 'comment',
    username: 'sarah_m',
    productImage: listingJacket,
    userAvatar: 'https://i.pravatar.cc/40?img=1',
    time: '24 minutes ago',
    read: false,
  },
  {
    id: '2',
    type: 'reply',
    username: 'mike_jones',
    productImage: listingSweater,
    userAvatar: 'https://i.pravatar.cc/40?img=2',
    time: '2 hours ago',
    read: false,
  },
  {
    id: '3',
    type: 'review',
    username: 'emma_style',
    productImage: listingSneakers,
    userAvatar: 'https://i.pravatar.cc/40?img=3',
    time: '10 hours ago',
    read: false,
  },
  {
    id: '4',
    type: 'comment',
    username: 'alex_vintage',
    productImage: listingSneakers,
    userAvatar: 'https://i.pravatar.cc/40?img=4',
    time: '25/2/2025',
    read: true,
  },
  {
    id: '5',
    type: 'reply',
    username: 'fashion_lover',
    productImage: listingBag,
    userAvatar: 'https://i.pravatar.cc/40?img=5',
    time: '17/12/2024',
    read: true,
  },
  {
    id: '6',
    type: 'review',
    username: 'closet_clean',
    productImage: listingJacket,
    userAvatar: 'https://i.pravatar.cc/40?img=6',
    time: '5/4/2024',
    read: true,
  },
];

const salesNotifications: SaleNotification[] = [
  {
    id: '1',
    username: 'buyer_jane',
    productImage: listingJacket,
    userAvatar: 'https://i.pravatar.cc/40?img=7',
    time: '24 minutes ago',
    status: 'awaiting',
  },
  {
    id: '2',
    username: 'style_hunter',
    productImage: listingSweater,
    userAvatar: 'https://i.pravatar.cc/40?img=8',
    time: '2 hours ago',
    status: 'awaiting',
  },
  {
    id: '3',
    username: 'thrift_queen',
    productImage: listingSneakers,
    userAvatar: 'https://i.pravatar.cc/40?img=9',
    time: '10 hours ago',
    status: 'awaiting',
  },
  {
    id: '4',
    username: 'vintage_vibes',
    productImage: listingSneakers,
    userAvatar: 'https://i.pravatar.cc/40?img=10',
    time: '10/2/2025',
    status: 'shipped',
  },
  {
    id: '5',
    username: 'eco_fashion',
    productImage: listingBag,
    userAvatar: 'https://i.pravatar.cc/40?img=11',
    time: '10/2/2025',
    status: 'shipped',
  },
  {
    id: '6',
    username: 'deal_seeker',
    productImage: listingJacket,
    userAvatar: 'https://i.pravatar.cc/40?img=12',
    time: '10/2/2025',
    status: 'delivered',
  },
  {
    id: '7',
    username: 'preloved_pro',
    productImage: listingSweater,
    userAvatar: 'https://i.pravatar.cc/40?img=13',
    time: '10/2/2025',
    status: 'delivered',
  },
];

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

const getStatusBadge = (status: SaleNotification['status']) => {
  switch (status) {
    case 'awaiting':
      return { label: 'Awaiting shipping', className: 'bg-accent text-accent-foreground' };
    case 'shipped':
      return { label: 'Shipped', className: 'bg-muted text-muted-foreground' };
    case 'delivered':
      return { label: 'Delivered', className: 'bg-muted text-muted-foreground' };
  }
};

const ProductThumbnail = ({ image, avatar }: { image: string; avatar: string }) => (
  <div className="relative h-20 w-20 flex-shrink-0">
    <img
      src={image}
      alt="Product"
      className="h-full w-full rounded-xl object-cover"
    />
    <img
      src={avatar}
      alt="User"
      className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 border-card object-cover"
    />
  </div>
);

const Notifications = () => {
  const [activeTab, setActiveTab] = useState<'activity' | 'sales'>('activity');

  const unreadNotifications = activityNotifications.filter(n => !n.read);
  const readNotifications = activityNotifications.filter(n => n.read);

  const awaitingShipping = salesNotifications.filter(n => n.status === 'awaiting');
  const shipped = salesNotifications.filter(n => n.status === 'shipped');
  const delivered = salesNotifications.filter(n => n.status === 'delivered');

  const unreadCount = unreadNotifications.length;
  const awaitingCount = awaitingShipping.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-foreground text-center">Notifications</h1>
      </header>

      {/* Tab Switcher */}
      <div className="flex justify-center pb-6">
        <div className="flex items-center rounded-full bg-muted p-1">
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              'relative flex items-center justify-center gap-2 rounded-full w-28 py-2.5 text-sm font-medium transition-all',
              activeTab === 'activity'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground'
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
              activeTab === 'sales'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground'
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

      {/* Content */}
      <div className="px-4 space-y-6">
        {activeTab === 'activity' ? (
          <>
            {/* Unread Section */}
            {unreadNotifications.length > 0 && (
              <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Unread</h2>
                <div className="space-y-3">
                  {unreadNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex gap-4 rounded-2xl bg-card p-4 card-shadow cursor-pointer"
                    >
                      <ProductThumbnail
                        image={notification.productImage}
                        avatar={notification.userAvatar}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">@{notification.username}</span>{' '}
                          {getActivityMessage(notification.type)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground text-right">
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
                  {readNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex gap-4 rounded-2xl bg-card p-4 cursor-pointer opacity-80"
                    >
                      <ProductThumbnail
                        image={notification.productImage}
                        avatar={notification.userAvatar}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">@{notification.username}</span>{' '}
                          {getActivityMessage(notification.type)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground text-right">
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
            {/* Awaiting Shipping */}
            {awaitingShipping.length > 0 && (
              <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Awaiting shipping</h2>
                <div className="space-y-3">
                  {awaitingShipping.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 card-shadow cursor-pointer"
                    >
                      <ProductThumbnail
                        image={sale.productImage}
                        avatar={sale.userAvatar}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          Sold to <span className="font-semibold">@{sale.username}.</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{sale.time}</p>
                        <span className={cn(
                          'mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium',
                          getStatusBadge(sale.status).className
                        )}>
                          {getStatusBadge(sale.status).label}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shipped */}
            {shipped.length > 0 && (
              <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Shipped</h2>
                <div className="space-y-3">
                  {shipped.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer"
                    >
                      <ProductThumbnail
                        image={sale.productImage}
                        avatar={sale.userAvatar}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          Sold to <span className="font-semibold">@{sale.username}.</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{sale.time}</p>
                        <span className={cn(
                          'mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium',
                          getStatusBadge(sale.status).className
                        )}>
                          {getStatusBadge(sale.status).label}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivered */}
            {delivered.length > 0 && (
              <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Delivered</h2>
                <div className="space-y-3">
                  {delivered.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer"
                    >
                      <ProductThumbnail
                        image={sale.productImage}
                        avatar={sale.userAvatar}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          Sold to <span className="font-semibold">@{sale.username}.</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{sale.time}</p>
                        <span className={cn(
                          'mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium',
                          getStatusBadge(sale.status).className
                        )}>
                          {getStatusBadge(sale.status).label}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Notifications;

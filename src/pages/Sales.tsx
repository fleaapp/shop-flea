import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import BottomNav from '@/components/BottomNav';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import { useOrders, Order, OrderGroup } from '@/hooks/useOrders';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const getStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'awaiting':
      return { label: 'Awaiting shipping', className: 'bg-accent text-accent-foreground' };
    case 'shipped':
      return { label: 'Shipped', className: 'bg-muted text-muted-foreground' };
    case 'delivered':
      return { label: 'Delivered', className: 'bg-muted text-muted-foreground' };
  }
};

const ProductThumbnail = ({ images, avatar, fallbackEmoji }: { images: string[]; avatar?: string; fallbackEmoji?: string }) => (
  <div className={cn('relative h-20 flex-shrink-0', images.length > 1 ? 'w-[6.5rem]' : 'w-20')}>
    {images.length > 1 && images[1] && (
      <img
        src={images[1]}
        alt="Product 2"
        className="absolute right-0 top-3 h-16 w-16 rounded-xl border-2 border-card object-cover"
        style={{ zIndex: 1 }}
      />
    )}
    <div className="absolute left-0 top-0 h-20 w-20" style={{ zIndex: 2 }}>
      {images[0] ? (
        <img
          src={images[0]}
          alt="Product"
          className="h-full w-full rounded-xl border-2 border-card object-cover"
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
        <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted">
          <span className="text-3xl">{fallbackEmoji || '📦'}</span>
        </div>
      )}
    </div>
    {avatar && (
      <img
        src={avatar}
        alt="User"
        className="absolute -bottom-1 left-14 h-7 w-7 rounded-full border-2 border-card object-cover"
        style={{ zIndex: 3 }}
      />
    )}
  </div>
);

const Sales = () => {
  const navigate = useNavigate();
  const [salesStatusFilter, setSalesStatusFilter] = useState<'awaiting' | 'shipped' | 'delivered'>('awaiting');
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const { sellerOrderGroups, loadingSellerOrders, markAsShipped } = useOrders();
  const { getGroupUnread } = useUnreadOrderMessages();

  const handleSaleClick = (group: OrderGroup) => {
    setSelectedGroup(group);
    setSaleSheetOpen(true);
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
    const productImages = group.orders.map(o => o.listing?.images?.[0] || '').filter(Boolean);
    const itemCount = group.orders.length;
    const unread = group.orders.reduce((sum, o) => sum + getGroupUnread(o.id), 0);

    return (
      <div
        onClick={() => handleSaleClick(group)}
        className={cn("flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer", showShadow && "card-shadow")}
      >
        <ProductThumbnail images={productImages.length ? productImages : ['']} avatar={buyerAvatar} />
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
          onClick={(e) => { e.stopPropagation(); navigate(`/order-chat/${group.order_group_id || primaryOrder.id}`); }}
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 py-4 flex items-center">
        <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-border bg-card hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-foreground pr-10">💸 Sales</h1>
      </header>

      {/* Status filter */}
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
                salesStatusFilter === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-3">
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
                  No sales yet.
                </p>
                <Button
                  onClick={() => navigate('/create-listing')}
                  className="mt-6 rounded-full bg-primary text-primary-foreground"
                >
                  Create Listing
                </Button>
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
                      {overdue.map(group => <SaleCard key={group.id} group={group} showShadow />)}
                    </div>
                  </div>
                )}
                {onTime.length > 0 && (
                  <div>
                    {overdue.length > 0 && <h2 className="mb-3 text-base font-semibold text-foreground">Awaiting Shipping</h2>}
                    <div className="space-y-3">
                      {onTime.map(group => <SaleCard key={group.id} group={group} showShadow />)}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {filteredSales.map(group => <SaleCard key={group.id} group={group} showShadow={false} />)}
            </div>
          );
        })()}
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

export default Sales;

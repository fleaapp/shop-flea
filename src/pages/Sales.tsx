import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import BottomNav from '@/components/BottomNav';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import OrderItemThumbnailStack from '@/components/OrderItemThumbnailStack';
import { useOrders, Order, OrderGroup } from '@/hooks/useOrders';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { cn } from '@/lib/utils';

import { safeNavigateBack } from '@/utils/safeBack';
import { useAuth } from '@/context/AuthContext';
import { useGuestMode } from '@/context/GuestModeContext';
import { useQueryClient } from '@tanstack/react-query';
import { clearOrderChatBadges } from '@/utils/orderChatRead';
import { supabase } from '@/lib/supabase';

const getStatusBadge = (status: OrderGroup['status']) => {
  switch (status) {
    case 'awaiting':
      return { label: 'Awaiting shipping', className: 'bg-accent text-accent-foreground' };
    case 'shipped':
      return { label: 'Shipped', className: 'bg-muted text-muted-foreground' };
    case 'delivered':
      return { label: 'Delivered - awaiting release', className: 'bg-muted text-muted-foreground' };
    case 'completed':
      return { label: 'Completed', className: 'bg-muted text-muted-foreground' };
    case 'refunded':
      return { label: 'Refunded', className: 'bg-muted text-muted-foreground' };
  }
};


const Sales = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { exitGuestMode } = useGuestMode();
  const [salesStatusFilter, setSalesStatusFilter] = useState<'awaiting' | 'shipped' | 'delivered' | 'completed'>('awaiting');
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const { sellerOrderGroups, loadingSellerOrders, markAsShipped } = useOrders();
  const { getGroupUnread } = useUnreadOrderMessages();

  const goToAuth = (tab: 'login' | 'signup') => {
    exitGuestMode();
    navigate('/auth', { state: { initialTab: tab } });
  };

  const handleSaleClick = (group: OrderGroup) => {
    setSelectedGroup(group);
    setSaleSheetOpen(true);
  };

  const openSaleChat = (group: OrderGroup) => {
    const threadId = group.order_group_id || group.orders[0]?.id || group.id;
    const relatedIds = group.orders.map((order) => order.id);
    if (user?.id) {
      clearOrderChatBadges({
        queryClient,
        userId: user.id,
        threadId,
        orderIds: relatedIds,
        role: 'seller',
      });
    }
    // Warm the message cache so the chat feels instant.
    queryClient.prefetchQuery({
      queryKey: ['order-messages', threadId],
      queryFn: async () => {
        const { data } = await (supabase as any)
          .from('order_messages')
          .select('id, order_id, sender_id, message, attachment_url, created_at, read, message_type')
          .in('order_id', relatedIds)
          .order('created_at', { ascending: true });
        return data || [];
      },
    });
    navigate(`/order-chat/${threadId}`);
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

  const SaleCard = ({ group, showShadow = false }: { group: OrderGroup; showShadow?: boolean }) => {
    const primaryOrder = group.orders[0];
    const rawBuyerUsername = primaryOrder.buyer_profile?.username || 'Unknown';
    const buyerUsername = rawBuyerUsername.startsWith('@') ? rawBuyerUsername.slice(1) : rawBuyerUsername;
    const buyerAvatar = primaryOrder.buyer_profile?.avatar_url || getDefaultAvatar(primaryOrder.buyer_id);
    const productImages = group.orders.slice(0, 2).map((order) => order.listing?.images?.[0]);
    const itemCount = group.orders.length;
    const unread = group.orders.reduce((sum, o) => sum + getGroupUnread(o.id), 0);
    const groupTotal = group.orders.reduce((sum, o) => sum + Number(o.price || 0) + Number(o.shipping_price || 0), 0);

    return (
      <div
        onClick={() => handleSaleClick(group)}
        className={cn("flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer", showShadow && "card-shadow")}
      >
        <OrderItemThumbnailStack imageUrls={productImages} itemCount={itemCount} avatarUrl={buyerAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            Sold to <span className="font-semibold">@{buyerUsername}</span>
            {itemCount > 1 ? <span className="text-muted-foreground"> • x{itemCount}</span> : null}.
          </p>
          <div className="mt-1 flex flex-col items-start gap-1.5">
            <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              ${groupTotal.toFixed(2)}
            </span>
            <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-medium', getStatusBadge(group.status).className)}>
              {getStatusBadge(group.status).label}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); openSaleChat(group); }}
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
    <div className="native-safe-top fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-background px-4 py-4 flex items-center">
        <button onClick={() => safeNavigateBack(navigate, '/profile')} className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-border bg-card hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-foreground pr-10">💸 Sales</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24">
        {/* Status filter */}
        <div className="flex justify-center px-4 pb-4">
          <div className="inline-flex items-center rounded-full bg-muted p-1">
            {([
              { key: 'awaiting' as const, label: 'To Ship' },
              { key: 'shipped' as const, label: 'Shipped' },
              { key: 'delivered' as const, label: 'Delivered' },
              { key: 'completed' as const, label: 'Completed' },
            ]).map(({ key, label }) => (

              <button
                key={key}
                onClick={() => setSalesStatusFilter(key)}
                className={cn(
                  'rounded-full px-3 py-2 text-xs font-medium transition-all whitespace-nowrap',
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
        {!user ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <p className="text-base font-bold text-foreground max-w-[280px] mb-2 leading-relaxed">
              Ready to sell?
            </p>
            <p className="text-sm text-muted-foreground max-w-[280px] mb-6 leading-relaxed">
              Log in or sign up to start selling on Flea.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-[220px]">
              <Button
                onClick={() => goToAuth('login')}
                className="h-11 rounded-full bg-muted-foreground/20 text-muted-foreground font-bold text-sm hover:bg-muted-foreground/30"
              >
                Log In / Sign Up
              </Button>
            </div>
          </div>
        ) : loadingSellerOrders ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <span className="text-5xl mb-4">⏳</span>
          </div>
        ) : (() => {
          const filteredSales = sellerOrderGroups.filter(g => {
            if (salesStatusFilter === 'completed') return g.status === 'completed' || g.status === 'refunded';
            if (salesStatusFilter === 'shipped') return g.status === 'shipped' || g.status === 'delivered';
            return g.status === salesStatusFilter;
          });

          if (filteredSales.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <span className="text-6xl opacity-50 mb-4">💸</span>
                <p className="text-lg font-medium text-muted-foreground">
                  No sales yet.
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

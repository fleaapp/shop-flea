import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { useOrders, Order, OrderGroup } from '@/hooks/useOrders';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CartItemRow from '@/components/CartItemRow';
import OrderDetailsSheet from '@/components/OrderDetailsSheet';
import { formatDistanceToNow } from 'date-fns';
import { Listing } from '@/types/listing';
import { fetchSellerShippingSettings, SellerShippingInfo } from '@/utils/shippingCalculator';
import { getAvatarUrl } from '@/utils/optimizedImage';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';

const getOrderStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'awaiting':
      return {
        label: 'Awaiting shipping',
        className: 'bg-accent text-accent-foreground',
      };
    case 'shipped':
      return {
        label: 'Shipped',
        className: 'bg-muted text-muted-foreground',
      };
    case 'delivered':
      return {
        label: 'Delivered',
        className: 'bg-muted text-muted-foreground',
      };
  }
};

const ProductThumbnail = ({
  image,
  avatar,
}: {
  image: string;
  avatar: string;
}) => (
  <div className="relative h-20 w-20 flex-shrink-0">
    <img src={image} alt="Product" className="h-full w-full rounded-xl object-cover" />
    <img
      src={avatar}
      alt="User"
      className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 border-card object-cover"
    />
  </div>
);

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart } = useCart();
  const { addFavorite } = useFavorites();
  const { removeDiscarded } = useDiscardedListings();
  const { buyerOrderGroups, loadingBuyerOrders, markAsDelivered } = useOrders();
  const { getGroupUnread, total: totalUnreadMessages } = useUnreadOrderMessages();
  const [activeTab, setActiveTab] = useState<'cart' | 'orders'>('cart');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'awaiting' | 'shipped' | 'delivered'>('awaiting');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedOrderGroup, setSelectedOrderGroup] = useState<OrderGroup | null>(null);
  const [sellerSettings, setSellerSettings] = useState<Map<string, SellerShippingInfo>>(new Map());

  // Fetch seller shipping settings for tiered shipping labels
  useEffect(() => {
    const sellerIds = [...new Set(cartItems.map(i => i.sellerId))];
    if (sellerIds.length === 0) return;
    fetchSellerShippingSettings(sellerIds).then(setSellerSettings);
  }, [cartItems]);

  const handleOrderClick = (group: OrderGroup) => {
    setSelectedOrderGroup(group);
  };

  const handleMarkDelivered = () => {
    if (!selectedOrderGroup) return;

    if (selectedOrderGroup.order_group_id) {
      markAsDelivered.mutate({ orderGroupId: selectedOrderGroup.order_group_id });
    } else {
      markAsDelivered.mutate(selectedOrderGroup.orders[0].id);
    }

    setSelectedOrderGroup(null);
  };

  // Use actual listing status from database including isPaused, isInactive, and isRemoved
  const cartItemsWithStatus = cartItems.map((item) => ({
    ...item,
    status: item.status || 'active',
    isPaused: (item as any).isPaused || false,
    isInactive: (item as any).isInactive || false,
    isRemoved: (item as any).isRemoved || item.status === 'removed',
  }));

  const toggleSelect = (id: string, sellerId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        // Clear selections from other sellers first
        const sellerItems = itemsBySeller[sellerId]?.map(i => i.id) || [];
        for (const itemId of prev) {
          if (!sellerItems.includes(itemId)) {
            newSet.delete(itemId);
          }
        }
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleListingClick = (item: Listing & { status?: string }) => {
    navigate(`/listing/${item.id}`);
  };

  const handleCheckout = (itemIds: string[]) => {
    // Filter out sold, paused, inactive, or removed items
    const validItems = cartItems.filter((item) => {
      const itemWithStatus = item as any;
      return itemIds.includes(item.id) && 
             itemWithStatus.status !== 'sold' && 
             itemWithStatus.status !== 'removed' &&
             !itemWithStatus.isPaused &&
             !itemWithStatus.isInactive &&
             !itemWithStatus.isRemoved;
    });
    
    if (validItems.length === 0) {
      toast.error('No available items to checkout');
      return;
    }
    
    navigate('/checkout', { state: { items: validItems } });
  };

  const handleCheckoutSelected = () => {
    if (selectedItems.size === 0) return;
    handleCheckout(Array.from(selectedItems));
  };

  const handleSwipeLeft = async (itemId: string) => {
    await removeFromCart(itemId);
    await removeDiscarded(itemId);
    toast.success('Removed from cart');
  };

  const handleSwipeRight = async (itemId: string) => {
    await removeFromCart(itemId);
    await removeDiscarded(itemId);
    await addFavorite(itemId);
    toast.success('Moved to wishlist');
  };

  // Group items by seller for combined checkout
  // Split removed items into separate groups so they get their own card
  const itemsBySeller: Record<string, typeof cartItemsWithStatus> = {};
  cartItemsWithStatus.forEach((item) => {
    const groupKey = item.isRemoved ? `${item.sellerId}__removed__${item.id}` : item.sellerId;
    if (!itemsBySeller[groupKey]) {
      itemsBySeller[groupKey] = [];
    }
    itemsBySeller[groupKey].push(item);
  });

  // Check which sellers have multiple items (for checkbox visibility)
  // Only count non-removed items for checkbox logic
  const sellersWithMultipleItems = new Set(
    Object.entries(itemsBySeller)
      .filter(([key, items]) => !key.includes('__removed__') && items.filter(i => i.status !== 'sold' && !i.isPaused && !i.isInactive && !i.isRemoved).length > 1)
      .map(([key]) => key)
  );

  // Filter order groups by status
  const awaitingOrders = buyerOrderGroups.filter((g) => g.status === 'awaiting');
  const shippedOrders = buyerOrderGroups.filter((g) => g.status === 'shipped');
  const deliveredOrders = buyerOrderGroups.filter((g) => g.status === 'delivered');

  // Orders badge: awaiting + shipped (not delivered) + unread messages
  const ordersBadgeCount = awaitingOrders.length + shippedOrders.length + totalUnreadMessages;

  const formatOrderTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const renderOrderCard = (group: OrderGroup, showShadow = false) => {
    const primaryOrder = group.orders[0];
    const rawUsername = primaryOrder.seller_profile?.username || 'Unknown';
    const sellerUsername = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername;
    const sellerAvatar = getAvatarUrl(primaryOrder.seller_profile?.avatar_url) || getDefaultAvatar(primaryOrder.seller_id);
    const productImage = primaryOrder.listing?.images?.[0] || '';
    const itemCount = group.orders.length;
    const unread = group.orders.reduce((sum, o) => sum + getGroupUnread(o.id), 0);

    return (
      <div
        key={group.id}
        onClick={() => handleOrderClick(group)}
        className={cn(
          "relative flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer",
          showShadow && "card-shadow"
        )}
      >
        <ProductThumbnail image={productImage} avatar={sellerAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            From <span className="font-semibold">@{sellerUsername}</span>
            {itemCount > 1 ? <span className="text-muted-foreground"> • {itemCount} items</span> : null}.
          </p>
          <p className="text-xs text-muted-foreground">{formatOrderTime(group.created_at)}</p>
          <span
            className={cn(
              'mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium',
              getOrderStatusBadge(group.status).className
            )}
          >
            {getOrderStatusBadge(group.status).label}
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

  return (
    <div className="min-h-screen bg-background pb-24 max-[375px]:pb-20">
      {/* Sticky Header with Wishlist Button */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="relative flex justify-center pt-8 max-[375px]:pt-6 pb-6 max-[375px]:pb-4">
        {/* Wishlist button - charcoal background with heart envelope emoji */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/favorites')}
            data-onboarding="cart-wishlist-button"
            className="absolute right-4 max-[375px]:right-3 top-8 max-[375px]:top-6 h-12 w-12 max-[375px]:h-10 max-[375px]:w-10 rounded-full bg-charcoal text-mint hover:bg-charcoal-light text-xl max-[375px]:text-lg"
          >
            💌
          </Button>

          {/* Tab switcher */}
          <div className="flex items-center rounded-full bg-muted p-1">
            <button
              onClick={() => setActiveTab('cart')}
              className={cn(
                'flex items-center justify-center gap-2 max-[375px]:gap-1.5 rounded-full w-28 max-[375px]:w-24 py-2.5 max-[375px]:py-2 text-sm max-[375px]:text-xs font-medium transition-all',
                activeTab === 'cart'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <span className="text-base max-[375px]:text-sm">🛒</span>
              Cart
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                'relative flex items-center justify-center gap-2 max-[375px]:gap-1.5 rounded-full w-28 max-[375px]:w-24 py-2.5 max-[375px]:py-2 text-sm max-[375px]:text-xs font-medium transition-all',
                activeTab === 'orders'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <span className="text-base max-[375px]:text-sm">🧾</span>
              Orders
              {activeTab !== 'orders' && ordersBadgeCount > 0 && (
                <span className="absolute -top-1 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {ordersBadgeCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status segmented toggle for orders */}
      {activeTab === 'orders' && (
        <div className="flex justify-center px-4 max-[375px]:px-3 pb-4">
          <div className="inline-flex items-center rounded-full bg-muted p-1">
            {([
              { key: 'awaiting' as const, label: 'To Ship' },
              { key: 'shipped' as const, label: 'Shipped' },
              { key: 'delivered' as const, label: 'Delivered' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setOrderStatusFilter(key)}
                className={cn(
                  'rounded-full w-24 py-2 text-sm font-medium transition-all',
                  orderStatusFilter === key
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

      {activeTab === 'cart' ? (
        <div className="px-4 max-[375px]:px-3 space-y-4 max-[375px]:space-y-3" data-onboarding="cart-items-area">
          {cartItems.length > 0 ? (
            <>
              {Object.entries(itemsBySeller).map(([groupKey, items]) => {
                const sellerId = items[0].sellerId;
                const isRemovedGroup = groupKey.includes('__removed__');
                // Check if all items in this seller group are unavailable (sold, paused, inactive, or removed)
                const allUnavailable = items.every(item => item.status === 'sold' || item.isPaused || item.isInactive || item.isRemoved);
                // Hide checkout only when all items are sold (paused/inactive still shows button)
                const allSold = items.every(item => item.status === 'sold');
                const allRemoved = items.every(item => item.isRemoved);
                
                return (
                  <div key={groupKey} className="rounded-2xl bg-card overflow-hidden card-shadow">
                    {/* Item rows within the same seller card */}
                    {items.map((item, index) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        isLast={index === items.length - 1 && (allSold || allRemoved)}
                        showSellerAvatar={index === 0 && !isRemovedGroup}
                        showCheckbox={sellersWithMultipleItems.has(groupKey) && item.status !== 'sold' && !item.isPaused && !item.isInactive && !item.isRemoved}
                        onToggleSelect={() => toggleSelect(item.id, groupKey)}
                        onSwipeLeft={() => handleSwipeLeft(item.id)}
                        onSwipeRight={() => handleSwipeRight(item.id)}
                        onCardClick={() => handleListingClick(item)}
                      />
                    ))}

                    {/* Removed item red button */}
                    {allRemoved && (
                      <Button
                        className="w-full rounded-none rounded-b-2xl bg-[hsl(4,90%,58%)] text-white h-12 cursor-not-allowed pointer-events-none font-semibold hover:bg-[hsl(4,90%,58%)]"
                      >
                        ⛔️ Item removed
                      </Button>
                    )}

                    {/* Tiered shipping label + Checkout button (only for non-removed groups) */}
                    {!allSold && !allRemoved && (() => {
                      const allPaused = items.every(item => item.isPaused);
                      const allInactive = items.every(item => item.isInactive);
                      const allPausedOrInactive = items.every(item => item.isPaused || item.isInactive);
                      const availableItems = items.filter(i => i.status !== 'sold' && !i.isPaused && !i.isInactive && !i.isRemoved);
                      const settings = sellerSettings.get(sellerId);
                      const showTierLabel = !allPausedOrInactive && settings?.tieredEnabled && availableItems.length > 1;
                      const tierText = showTierLabel
                        ? availableItems.length <= 3
                          ? `2–3 items: $${settings!.tier2.toFixed(2)} combined shipping`
                          : `4+ items: $${settings!.tier3.toFixed(2)} combined shipping`
                        : null;

                      return (
                        <>
                          {tierText && (
                            <div className="px-4 py-2 bg-accent/30 text-center">
                             <span className="text-xs text-accent-foreground">📦 {showTierLabel && availableItems.length <= 3
                                ? <><span className="font-bold">2–3 items:</span> ${settings!.tier2.toFixed(2)} combined shipping</>
                                : <><span className="font-bold">4+ items:</span> ${settings!.tier3.toFixed(2)} combined shipping</>
                              }</span>
                            </div>
                          )}
                          {allPausedOrInactive ? (
                            <Button
                              className="w-full rounded-none rounded-b-2xl bg-[#787878] text-white h-12 cursor-not-allowed pointer-events-none font-semibold hover:bg-[#787878]"
                            >
                              {allInactive && !allPaused ? '🕰️ Inactive' : '⏸️ Paused'}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                const selectedFromSeller = items.filter(i => selectedItems.has(i.id) && i.status !== 'sold' && !i.isPaused && !i.isInactive && !i.isRemoved);
                                if (selectedFromSeller.length > 0) {
                                  handleCheckout(selectedFromSeller.map(i => i.id));
                                } else {
                                  handleCheckout(availableItems.map(i => i.id));
                                }
                              }}
                              className="w-full rounded-none rounded-b-2xl bg-charcoal text-white hover:bg-charcoal-light h-12"
                            >
                              {selectedItems.size > 0 && items.some(i => selectedItems.has(i.id)) 
                                ? `Checkout ${items.filter(i => selectedItems.has(i.id) && i.status !== 'sold' && !i.isPaused && !i.isInactive && !i.isRemoved).length} selected`
                                : 'Checkout'
                              }
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                );
              })}

            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <span className="text-6xl opacity-50 mb-4">🛒</span>
              <p className="text-lg font-medium text-muted-foreground">Your cart is empty</p>
              <p className="mt-2 text-sm text-muted-foreground">Swipe up on items to add them</p>
              <Button
                onClick={() => navigate('/')}
                className="mt-6 rounded-full bg-primary text-primary-foreground"
              >
                Browse Listings
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 max-[375px]:px-3 space-y-6 max-[375px]:space-y-4">
          {loadingBuyerOrders ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <span className="text-5xl mb-4">⏳</span>
            </div>
          ) : (() => {
            const filteredOrders = buyerOrderGroups.filter((g) => g.status === orderStatusFilter);
            if (filteredOrders.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                  <span className="text-6xl opacity-50 mb-4">🧾</span>
                  <p className="text-lg font-medium text-muted-foreground">
                    {orderStatusFilter === 'awaiting' && 'No orders to ship yet'}
                    {orderStatusFilter === 'shipped' && 'No shipped orders yet'}
                    {orderStatusFilter === 'delivered' && 'No delivered orders yet'}
                  </p>
                </div>
              );
            }

            if (orderStatusFilter === 'awaiting') {
              const now = Date.now();
              const FOUR_DAYS = 4 * 24 * 60 * 60 * 1000;
              const overdue = filteredOrders.filter((g) => now - new Date(g.created_at).getTime() >= FOUR_DAYS);
              const onTime = filteredOrders.filter((g) => now - new Date(g.created_at).getTime() < FOUR_DAYS);

              return (
                <div className="space-y-6">
                  {overdue.length > 0 && (
                    <div>
                      <h2 className="mb-3 text-base font-semibold text-destructive">🚨 Overdue</h2>
                      <div className="space-y-3">
                        {overdue.map((order) => renderOrderCard(order, true))}
                      </div>
                    </div>
                  )}
                  {onTime.length > 0 && (
                    <div>
                      {overdue.length > 0 && (
                        <h2 className="mb-3 text-base font-semibold text-foreground">Awaiting Shipping</h2>
                      )}
                      <div className="space-y-3">
                        {onTime.map((order) => renderOrderCard(order, true))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredOrders.map((order) => renderOrderCard(order, false))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Order Details Drawer */}
      <OrderDetailsSheet
        orders={selectedOrderGroup?.orders ?? null}
        open={!!selectedOrderGroup}
        onOpenChange={(open) => !open && setSelectedOrderGroup(null)}
        onMarkDelivered={handleMarkDelivered}
      />

      <BottomNav />
    </div>
  );
};

export default Cart;

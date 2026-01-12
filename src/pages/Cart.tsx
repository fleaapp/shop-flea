import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { useOrders, Order } from '@/hooks/useOrders';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CartItemRow from '@/components/CartItemRow';
import OrderDetailsSheet from '@/components/OrderDetailsSheet';
import { formatDistanceToNow } from 'date-fns';

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
  const { addDiscarded } = useDiscardedListings();
  const { buyerOrders, loadingBuyerOrders, markAsDelivered } = useOrders();
  const [activeTab, setActiveTab] = useState<'cart' | 'orders'>('cart');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleMarkDelivered = () => {
    if (selectedOrder) {
      markAsDelivered.mutate(selectedOrder.id);
      setSelectedOrder(null);
    }
  };

  // Use actual listing status from database
  const cartItemsWithStatus = cartItems.map((item) => ({
    ...item,
    status: item.status || 'active',
  }));

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleCheckout = (itemIds: string[]) => {
    const checkoutItems = cartItems.filter((item) => itemIds.includes(item.id));
    navigate('/checkout', { state: { items: checkoutItems } });
  };

  const handleCheckoutSelected = () => {
    if (selectedItems.size === 0) return;
    handleCheckout(Array.from(selectedItems));
  };

  const handleSwipeLeft = async (itemId: string) => {
    await removeFromCart(itemId);
    await addDiscarded(itemId);
    toast.success('Removed from cart');
  };

  const handleSwipeRight = async (itemId: string) => {
    await removeFromCart(itemId);
    await addFavorite(itemId);
    toast.success('Moved to wishlist');
  };

  // Group items by seller for combined checkout
  const itemsBySeller = cartItemsWithStatus.reduce((acc, item) => {
    if (!acc[item.sellerId]) {
      acc[item.sellerId] = [];
    }
    acc[item.sellerId].push(item);
    return acc;
  }, {} as Record<string, typeof cartItemsWithStatus>);

  // Filter orders by status
  const awaitingOrders = buyerOrders.filter((o) => o.status === 'awaiting');
  const shippedOrders = buyerOrders.filter((o) => o.status === 'shipped');
  const deliveredOrders = buyerOrders.filter((o) => o.status === 'delivered');

  const formatOrderTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const OrderCard = ({ order, showShadow = false }: { order: Order; showShadow?: boolean }) => {
    const sellerUsername = order.seller_profile?.username || 'Unknown';
    const sellerAvatar = order.seller_profile?.avatar_url || '';
    const productImage = order.listing?.images?.[0] || '';

    return (
      <div
        onClick={() => handleOrderClick(order)}
        className={cn(
          "flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer",
          showShadow && "card-shadow"
        )}
      >
        <ProductThumbnail image={productImage} avatar={sellerAvatar} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            From <span className="font-semibold">@{sellerUsername}.</span>
          </p>
          <p className="text-xs text-muted-foreground">{formatOrderTime(order.created_at)}</p>
          <span
            className={cn(
              'mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium',
              getOrderStatusBadge(order.status).className
            )}
          >
            {getOrderStatusBadge(order.status).label}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Header with Wishlist Button */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="relative flex justify-center pt-8 pb-6">
          {/* Wishlist button - charcoal background with heart envelope emoji */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/favorites')}
            className="absolute right-4 top-8 h-12 w-12 rounded-full bg-charcoal text-mint hover:bg-charcoal-light text-xl"
          >
            💌
          </Button>

          {/* Tab switcher */}
          <div className="flex items-center rounded-full bg-muted p-1">
            <button
              onClick={() => setActiveTab('cart')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-full w-28 py-2.5 text-sm font-medium transition-all',
                activeTab === 'cart'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <span className="text-base">🛒</span>
              Cart
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-full w-28 py-2.5 text-sm font-medium transition-all',
                activeTab === 'orders'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <span className="text-base">🧾</span>
              Orders
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'cart' ? (
        <div className="px-4 space-y-4">
          {cartItems.length > 0 ? (
            <>
              {Object.entries(itemsBySeller).map(([sellerId, items]) => {
                // Check if all items in this seller group are sold
                const allSold = items.every(item => item.status === 'sold');
                
                return (
                  <div key={sellerId} className="rounded-2xl bg-card overflow-hidden card-shadow">
                    {/* Item rows within the same seller card */}
                    {items.map((item, index) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        isLast={index === items.length - 1 && allSold}
                        showSellerAvatar={index === 0}
                        onToggleSelect={() => toggleSelect(item.id)}
                        onSwipeLeft={() => handleSwipeLeft(item.id)}
                        onSwipeRight={() => handleSwipeRight(item.id)}
                      />
                    ))}

                    {/* Checkout button - only show if not all items are sold */}
                    {!allSold && (
                      <Button
                        onClick={() => handleCheckout(items.filter(i => i.status !== 'sold').map(i => i.id))}
                        className="w-full rounded-none rounded-b-2xl bg-charcoal text-white hover:bg-charcoal-light h-12"
                      >
                        Checkout
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* Checkout selected button */}
              {selectedItems.size > 1 && (
                <div className="fixed bottom-24 left-4 right-4 z-40">
                  <Button
                    onClick={handleCheckoutSelected}
                    className="w-full rounded-2xl bg-primary text-primary-foreground h-14 text-base font-medium"
                  >
                    Checkout {selectedItems.size} selected items
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
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
        <div className="px-4 space-y-6">
          {loadingBuyerOrders ? (
            <div className="flex justify-center py-10">
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          ) : buyerOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="text-6xl opacity-50 mb-4">🧾</span>
              <p className="text-lg font-medium text-muted-foreground">No orders yet</p>
              <p className="mt-2 text-sm text-muted-foreground">Your purchases will appear here</p>
            </div>
          ) : (
            <>
              {/* Awaiting Shipping */}
              {awaitingOrders.length > 0 && (
                <div>
                  <h2 className="mb-3 text-base font-semibold text-foreground">Awaiting shipping</h2>
                  <div className="space-y-3">
                    {awaitingOrders.map((order) => (
                      <OrderCard key={order.id} order={order} showShadow />
                    ))}
                  </div>
                </div>
              )}

              {/* Shipped */}
              {shippedOrders.length > 0 && (
                <div>
                  <h2 className="mb-3 text-base font-semibold text-foreground">Shipped</h2>
                  <div className="space-y-3">
                    {shippedOrders.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              )}

              {/* Delivered */}
              {deliveredOrders.length > 0 && (
                <div>
                  <h2 className="mb-3 text-base font-semibold text-foreground">Delivered</h2>
                  <div className="space-y-3">
                    {deliveredOrders.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Order Details Drawer */}
      <OrderDetailsSheet
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        onMarkDelivered={handleMarkDelivered}
      />

      <BottomNav />
    </div>
  );
};

export default Cart;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight } from 'lucide-react';
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
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';

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
  const { buyerOrderGroups, loadingBuyerOrders, markAsDelivered } = useOrders();
  const [activeTab, setActiveTab] = useState<'cart' | 'orders'>('cart');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedOrderGroup, setSelectedOrderGroup] = useState<OrderGroup | null>(null);
  const [selectedListing, setSelectedListing] = useState<(Listing & { status?: string }) | null>(null);

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

  // Use actual listing status from database
  const cartItemsWithStatus = cartItems.map((item) => ({
    ...item,
    status: item.status || 'active',
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
    setSelectedListing(item);
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

  // Group items by seller for combined checkout - moved before toggleSelect for proper usage
  const itemsBySeller = cartItemsWithStatus.reduce((acc, item) => {
    if (!acc[item.sellerId]) {
      acc[item.sellerId] = [];
    }
    acc[item.sellerId].push(item);
    return acc;
  }, {} as Record<string, typeof cartItemsWithStatus>);

  // Check which sellers have multiple items (for checkbox visibility)
  const sellersWithMultipleItems = new Set(
    Object.entries(itemsBySeller)
      .filter(([_, items]) => items.filter(i => i.status !== 'sold').length > 1)
      .map(([sellerId]) => sellerId)
  );

  // Filter order groups by status
  const awaitingOrders = buyerOrderGroups.filter((g) => g.status === 'awaiting');
  const shippedOrders = buyerOrderGroups.filter((g) => g.status === 'shipped');
  const deliveredOrders = buyerOrderGroups.filter((g) => g.status === 'delivered');

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
    const sellerAvatar = primaryOrder.seller_profile?.avatar_url || '';
    const productImage = primaryOrder.listing?.images?.[0] || '';
    const itemCount = group.orders.length;

    return (
      <div
        key={group.id}
        onClick={() => handleOrderClick(group)}
        className={cn(
          "flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer",
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
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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
                'flex items-center justify-center gap-2 max-[375px]:gap-1.5 rounded-full w-28 max-[375px]:w-24 py-2.5 max-[375px]:py-2 text-sm max-[375px]:text-xs font-medium transition-all',
                activeTab === 'orders'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <span className="text-base max-[375px]:text-sm">🧾</span>
              Orders
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'cart' ? (
        <div className="px-4 max-[375px]:px-3 space-y-4 max-[375px]:space-y-3">
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
                        showCheckbox={sellersWithMultipleItems.has(sellerId) && item.status !== 'sold'}
                        onToggleSelect={() => toggleSelect(item.id, sellerId)}
                        onSwipeLeft={() => handleSwipeLeft(item.id)}
                        onSwipeRight={() => handleSwipeRight(item.id)}
                        onCardClick={() => handleListingClick(item)}
                      />
                    ))}

                    {/* Checkout button - only show if not all items are sold */}
                    {!allSold && (
                      <Button
                        onClick={() => {
                          // If user has selected items from this seller, checkout those
                          const selectedFromSeller = items.filter(i => selectedItems.has(i.id) && i.status !== 'sold');
                          if (selectedFromSeller.length > 0) {
                            handleCheckout(selectedFromSeller.map(i => i.id));
                          } else {
                            // Otherwise checkout all non-sold items from this seller
                            handleCheckout(items.filter(i => i.status !== 'sold').map(i => i.id));
                          }
                        }}
                        className="w-full rounded-none rounded-b-2xl bg-charcoal text-white hover:bg-charcoal-light h-12"
                      >
                        {selectedItems.size > 0 && items.some(i => selectedItems.has(i.id)) 
                          ? `Checkout ${items.filter(i => selectedItems.has(i.id) && i.status !== 'sold').length} selected`
                          : 'Checkout'
                        }
                      </Button>
                    )}
                  </div>
                );
              })}

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
        <div className="px-4 max-[375px]:px-3 space-y-6 max-[375px]:space-y-4">
          {loadingBuyerOrders ? (
            <div className="flex justify-center py-10">
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          ) : buyerOrderGroups.length === 0 ? (
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
                    {awaitingOrders.map((order) => renderOrderCard(order, true))}
                  </div>
                </div>
              )}

              {/* Shipped */}
              {shippedOrders.length > 0 && (
                <div>
                  <h2 className="mb-3 text-base font-semibold text-foreground">Shipped</h2>
                  <div className="space-y-3">
                    {shippedOrders.map((order) => renderOrderCard(order, false))}
                  </div>
                </div>
              )}

              {/* Delivered */}
              {deliveredOrders.length > 0 && (
                <div>
                  <h2 className="mb-3 text-base font-semibold text-foreground">Delivered</h2>
                  <div className="space-y-3">
                    {deliveredOrders.map((order) => renderOrderCard(order, false))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Order Details Drawer */}
      <OrderDetailsSheet
        orders={selectedOrderGroup?.orders ?? null}
        open={!!selectedOrderGroup}
        onOpenChange={(open) => !open && setSelectedOrderGroup(null)}
        onMarkDelivered={handleMarkDelivered}
      />

      {/* Listing Details Drawer */}
      {selectedListing && (
        <CartListingDetailsDrawer
          listing={selectedListing}
          open={!!selectedListing}
          onOpenChange={(open) => !open && setSelectedListing(null)}
        />
      )}

      <BottomNav />
    </div>
  );
};

// Inline listing details drawer for cart items
const CartListingDetailsDrawer = ({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing & { status?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const navigate = useNavigate();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const { addFavorite, isFavorite } = useFavorites();
  const { removeFromCart } = useCart();
  const { addDiscarded } = useDiscardedListings();

  const isSold = listing.status === 'sold';
  const images = listing.images?.length ? listing.images : [listing.image];

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveImageIndex(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  const handleAddToWishlist = async () => {
    if (isFavorite(listing.id)) {
      toast.info('Already in wishlist');
      return;
    }
    await removeFromCart(listing.id);
    await addFavorite(listing.id);
    toast.success('Moved to wishlist!');
    onOpenChange(false);
  };

  const handleDiscard = async () => {
    await removeFromCart(listing.id);
    await addDiscarded(listing.id);
    toast.success('Item discarded');
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mt-0 h-[95dvh] max-h-[95dvh] overflow-hidden rounded-t-3xl bg-background">
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* Image Gallery */}
          <div className="relative overflow-hidden rounded-3xl">
            <Carousel setApi={setCarouselApi} opts={{ loop: images.length > 1 }} className="w-full">
              <CarouselContent className="ml-0">
                {images.map((src: string, index: number) => (
                  <CarouselItem key={`${listing.id}-img-${index}`} className="pl-0">
                    <img
                      src={src}
                      alt={`${listing.title} photo ${index + 1}`}
                      className="aspect-square w-full object-cover"
                      loading={index === 0 ? 'eager' : 'lazy'}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            {images.length > 1 && (
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-background/70 px-2 py-1 text-xs text-foreground">
                {activeImageIndex + 1}/{images.length}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mt-4 gap-2 flex flex-row overflow-x-auto scrollbar-hide">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground uppercase">{listing.size}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground capitalize">{listing.brand}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground capitalize">{listing.condition}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground capitalize">{listing.category}</span>
          </div>

          {/* Content */}
          <div className="pt-4">
            <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>
            {listing.description && (
              <p className="mt-4 text-muted-foreground leading-relaxed">{listing.description}</p>
            )}

            {/* Seller Info + Price Row */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <div 
                className="flex items-center gap-2 rounded-2xl bg-card p-2.5 pr-6 card-shadow cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => navigate(`/seller/${listing.sellerId}`), 300);
                }}
              >
                <img
                  src={listing.sellerAvatar}
                  alt={listing.sellerName}
                  className="h-9 w-9 rounded-full bg-muted flex-shrink-0"
                  loading="lazy"
                />
                <div>
                  <p className="font-medium text-foreground text-sm">{listing.sellerName}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{listing.location || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">${listing.price}</p>
                <p className="text-xs text-muted-foreground">+ ${listing.shippingPrice || 0} shipping</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="sticky bottom-0 left-0 right-0 flex gap-3 bg-background px-4 py-4 border-t border-border justify-center">
          <Button
            variant="outline"
            onClick={handleDiscard}
            className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]"
          >
            ❌
          </Button>

          {!isSold && (
            <Button
              variant="outline"
              onClick={handleAddToWishlist}
              className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]"
            >
              💌
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default Cart;

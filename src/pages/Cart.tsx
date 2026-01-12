import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ClipboardList, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CartItemRow from '@/components/CartItemRow';
import OrderDetailsSheet, { OrderDetails } from '@/components/OrderDetailsSheet';
import listingJacket from '@/assets/listing-jacket.jpg';
import listingSneakers from '@/assets/listing-sneakers.jpg';
import listingSweater from '@/assets/listing-sweater.jpg';
import listingBag from '@/assets/listing-bag.jpg';

type OrderNotification = {
  id: string;
  username: string;
  productImage: string;
  userAvatar: string;
  time: string;
  status: 'awaiting' | 'shipped' | 'delivered';
};

// Extended mock orders with full details for the drawer
const mockOrderDetails: Record<string, OrderDetails> = {
  '1': {
    id: '1',
    orderNumber: '2357',
    date: '12/2/2025',
    status: 'awaiting',
    seller: { username: 'vintage_seller', avatar: 'https://i.pravatar.cc/40?img=14' },
    items: [
      { id: '1a', title: 'Vintage Leather Jacket', image: listingJacket, price: 45, shippingPrice: 10 },
    ],
    shippingDetails: { name: 'Sarah Hearn', address: '123 Smile road, Melbourne, 3100' },
    trackingDetails: { serviceProvider: 'Awaiting shipping', trackingNumber: 'Awaiting shipping' },
  },
  '2': {
    id: '2',
    orderNumber: '2358',
    date: '11/2/2025',
    status: 'awaiting',
    seller: { username: 'style_closet', avatar: 'https://i.pravatar.cc/40?img=15' },
    items: [
      { id: '2a', title: 'Cozy Knit Sweater', image: listingSweater, price: 32, shippingPrice: 8 },
    ],
    shippingDetails: { name: 'Sarah Hearn', address: '123 Smile road, Melbourne, 3100' },
    trackingDetails: { serviceProvider: 'Awaiting shipping', trackingNumber: 'Awaiting shipping' },
  },
  '3': {
    id: '3',
    orderNumber: '2359',
    date: '8/2/2025',
    status: 'shipped',
    seller: { username: 'fashion_finds', avatar: 'https://i.pravatar.cc/40?img=16' },
    items: [
      { id: '3a', title: 'Nike Sneakers', image: listingSneakers, price: 22, shippingPrice: 10 },
    ],
    shippingDetails: { name: 'Sarah Hearn', address: '123 Smile road, Melbourne, 3100' },
    trackingDetails: { serviceProvider: 'Australia Post', trackingNumber: 'AP123456789AU' },
  },
  '4': {
    id: '4',
    orderNumber: '2360',
    date: '15/1/2025',
    status: 'shipped',
    seller: { username: 'thrift_treasures', avatar: 'https://i.pravatar.cc/40?img=17' },
    items: [
      { id: '4a', title: 'Designer Bag', image: listingBag, price: 55, shippingPrice: 12 },
    ],
    shippingDetails: { name: 'Sarah Hearn', address: '123 Smile road, Melbourne, 3100' },
    trackingDetails: { serviceProvider: 'Sendle', trackingNumber: 'SEN987654321' },
  },
  '5': {
    id: '5',
    orderNumber: '2361',
    date: '10/1/2025',
    status: 'delivered',
    seller: { username: 'eco_wardrobe', avatar: 'https://i.pravatar.cc/40?img=18' },
    items: [
      { id: '5a', title: 'Vintage Leather Jacket', image: listingJacket, price: 45, shippingPrice: 10 },
    ],
    shippingDetails: { name: 'Sarah Hearn', address: '123 Smile road, Melbourne, 3100' },
    trackingDetails: { serviceProvider: 'Australia Post', trackingNumber: 'AP111222333AU' },
  },
  '6': {
    id: '6',
    orderNumber: '2362',
    date: '5/1/2025',
    status: 'delivered',
    seller: { username: 'preloved_gems', avatar: 'https://i.pravatar.cc/40?img=19' },
    items: [
      { id: '6a', title: 'Cozy Knit Sweater', image: listingSweater, price: 32, shippingPrice: 8 },
    ],
    shippingDetails: { name: 'Sarah Hearn', address: '123 Smile road, Melbourne, 3100' },
    trackingDetails: { serviceProvider: 'Sendle', trackingNumber: 'SEN444555666' },
  },
};

const mockOrders: OrderNotification[] = [
  {
    id: '1',
    username: 'vintage_seller',
    productImage: listingJacket,
    userAvatar: 'https://i.pravatar.cc/40?img=14',
    time: '2 hours ago',
    status: 'awaiting',
  },
  {
    id: '2',
    username: 'style_closet',
    productImage: listingSweater,
    userAvatar: 'https://i.pravatar.cc/40?img=15',
    time: '1 day ago',
    status: 'awaiting',
  },
  {
    id: '3',
    username: 'fashion_finds',
    productImage: listingSneakers,
    userAvatar: 'https://i.pravatar.cc/40?img=16',
    time: '3 days ago',
    status: 'shipped',
  },
  {
    id: '4',
    username: 'thrift_treasures',
    productImage: listingBag,
    userAvatar: 'https://i.pravatar.cc/40?img=17',
    time: '15/1/2025',
    status: 'shipped',
  },
  {
    id: '5',
    username: 'eco_wardrobe',
    productImage: listingJacket,
    userAvatar: 'https://i.pravatar.cc/40?img=18',
    time: '10/1/2025',
    status: 'delivered',
  },
  {
    id: '6',
    username: 'preloved_gems',
    productImage: listingSweater,
    userAvatar: 'https://i.pravatar.cc/40?img=19',
    time: '5/1/2025',
    status: 'delivered',
  },
];

const getOrderStatusBadge = (status: OrderNotification['status']) => {
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
  const [activeTab, setActiveTab] = useState<'cart' | 'orders'>('cart');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  const handleMarkDelivered = () => {
    toast.success('Order marked as delivered');
    setSelectedOrderId(null);
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
              <ShoppingCart className="h-4 w-4" />
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
              <ClipboardList className="h-4 w-4" />
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
                const hasAnySold = items.some(item => item.status === 'sold');
                
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
          {/* Awaiting Shipping */}
          {mockOrders.filter((o) => o.status === 'awaiting').length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-foreground">Awaiting shipping</h2>
              <div className="space-y-3">
                {mockOrders
                  .filter((o) => o.status === 'awaiting')
                  .map((order) => (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order.id)}
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 card-shadow cursor-pointer"
                    >
                      <ProductThumbnail image={order.productImage} avatar={order.userAvatar} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          From <span className="font-semibold">@{order.username}.</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{order.time}</p>
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
                  ))}
              </div>
            </div>
          )}

          {/* Shipped */}
          {mockOrders.filter((o) => o.status === 'shipped').length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-foreground">Shipped</h2>
              <div className="space-y-3">
                {mockOrders
                  .filter((o) => o.status === 'shipped')
                  .map((order) => (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order.id)}
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer"
                    >
                      <ProductThumbnail image={order.productImage} avatar={order.userAvatar} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          From <span className="font-semibold">@{order.username}.</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{order.time}</p>
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
                  ))}
              </div>
            </div>
          )}

          {/* Delivered */}
          {mockOrders.filter((o) => o.status === 'delivered').length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-foreground">Delivered</h2>
              <div className="space-y-3">
                {mockOrders
                  .filter((o) => o.status === 'delivered')
                  .map((order) => (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order.id)}
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 cursor-pointer"
                    >
                      <ProductThumbnail image={order.productImage} avatar={order.userAvatar} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          From <span className="font-semibold">@{order.username}.</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{order.time}</p>
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
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Details Drawer */}
      <OrderDetailsSheet
        order={selectedOrderId ? mockOrderDetails[selectedOrderId] : null}
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        onMarkDelivered={handleMarkDelivered}
      />

      <BottomNav />
    </div>
  );
};

export default Cart;

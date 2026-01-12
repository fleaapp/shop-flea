import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ClipboardList, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CartItemRow from '@/components/CartItemRow';

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart } = useCart();
  const { addFavorite } = useFavorites();
  const { addDiscarded } = useDiscardedListings();
  const [activeTab, setActiveTab] = useState<'cart' | 'orders'>('cart');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Mock: Mark one item as sold for demo purposes
  const cartItemsWithStatus = cartItems.map((item, index) => ({
    ...item,
    status: index === 0 && cartItems.length > 1 ? 'sold' : 'active',
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
    removeFromCart(itemId);
    await addDiscarded(itemId);
    toast.success('Removed from cart');
  };

  const handleSwipeRight = async (itemId: string) => {
    removeFromCart(itemId);
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
          {/* Wishlist button - charcoal background with lime star */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/favorites')}
            className="absolute right-4 top-8 h-12 w-12 rounded-full bg-charcoal text-mint hover:bg-charcoal-light"
          >
            <Star className="h-6 w-6" />
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
        <div className="px-4">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No orders yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Your purchase history will appear here</p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Cart;

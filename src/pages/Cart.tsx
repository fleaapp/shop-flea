import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ClipboardList, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart } = useCart();
  const [activeTab, setActiveTab] = useState<'cart' | 'orders'>('cart');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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

  // Group items by seller for combined checkout
  const itemsBySeller = cartItems.reduce((acc, item) => {
    if (!acc[item.sellerId]) {
      acc[item.sellerId] = [];
    }
    acc[item.sellerId].push(item);
    return acc;
  }, {} as Record<string, typeof cartItems>);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Tab Header */}
      <div className="flex justify-center pt-8 pb-6">
        <div className="flex items-center rounded-full bg-muted p-1">
          <button
            onClick={() => setActiveTab('cart')}
            className={cn(
              'flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all',
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
              'flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all',
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

      {activeTab === 'cart' ? (
        <div className="px-4 space-y-4">
          {cartItems.length > 0 ? (
            <>
              {Object.entries(itemsBySeller).map(([sellerId, items]) => (
                <div key={sellerId} className="space-y-3">
                  {items.map((item, index) => {
                    const isSelected = selectedItems.has(item.id);
                    const isLastInGroup = index === items.length - 1;
                    const showGroupCheckout = isLastInGroup && items.length > 1 && 
                      items.every(i => selectedItems.has(i.id));

                    return (
                      <div key={item.id}>
                        <div
                          className="rounded-2xl bg-card overflow-hidden card-shadow"
                        >
                          <div className="flex gap-4 p-4">
                            {/* Image with selection checkbox */}
                            <div
                              className="relative h-24 w-24 flex-shrink-0 cursor-pointer"
                              onClick={() => toggleSelect(item.id)}
                            >
                              <img
                                src={item.image}
                                alt={item.title}
                                className="h-full w-full rounded-xl object-cover"
                              />
                              {isSelected && (
                                <div className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded bg-charcoal">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex flex-1 flex-col justify-center">
                              <div className="flex items-start justify-between">
                                <h3 className="font-semibold text-foreground">{item.title}</h3>
                                <img
                                  src={item.sellerAvatar}
                                  alt={item.sellerName}
                                  className="h-8 w-8 rounded-full bg-muted"
                                />
                              </div>
                              <p className="text-lg font-bold text-foreground mt-1">
                                ${item.price}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                + ${item.shippingPrice} shipping
                              </p>
                            </div>
                          </div>

                          {/* Checkout button */}
                          {!showGroupCheckout && (
                            <Button
                              onClick={() => handleCheckout([item.id])}
                              className="w-full rounded-none rounded-b-2xl bg-charcoal text-white hover:bg-charcoal-light h-12"
                            >
                              Checkout
                            </Button>
                          )}
                        </div>

                        {/* Group checkout for multiple items from same seller */}
                        {showGroupCheckout && (
                          <Button
                            onClick={() => handleCheckout(items.map(i => i.id))}
                            className="w-full mt-3 rounded-2xl bg-charcoal text-white hover:bg-charcoal-light h-12"
                          >
                            Checkout {items.length} items from {item.sellerName}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

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

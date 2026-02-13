import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Listing } from '@/types/listing';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import BlockedUserBanner from '@/components/BlockedUserBanner';
import { fetchSellerShippingSettings, calculateTotalShipping, SellerShippingInfo } from '@/utils/shippingCalculator';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isBlocked } = useBlockedStatus();
  const {
    removeFromCart
  } = useCart();
  const items: Listing[] = location.state?.items || [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(true);
  const [sellerSettings, setSellerSettings] = useState<Map<string, SellerShippingInfo>>(new Map());

  // Shipping details state
  const [shippingFirstName, setShippingFirstName] = useState('');
  const [shippingLastName, setShippingLastName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostcode, setShippingPostcode] = useState('');

  // Fetch seller shipping settings
  useEffect(() => {
    const loadSellerSettings = async () => {
      if (items.length === 0) return;
      
      const sellerIds = [...new Set(items.map(item => item.sellerId))];
      const settings = await fetchSellerShippingSettings(sellerIds);
      setSellerSettings(settings);
    };
    
    loadSellerSettings();
  }, [items]);

  // Fetch seller Stripe account IDs
  const [sellerStripeAccounts, setSellerStripeAccounts] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const loadSellerStripe = async () => {
      if (items.length === 0) return;
      const sellerIds = [...new Set(items.map(item => item.sellerId))];
      const { data } = await supabase
        .from('profiles' as any)
        .select('user_id, stripe_account_id, stripe_onboarding_complete')
        .in('user_id', sellerIds);
      
      const accounts = new Map<string, string>();
      data?.forEach((p: any) => {
        if (p.stripe_account_id && p.stripe_onboarding_complete) {
          accounts.set(p.user_id, p.stripe_account_id);
        }
      });
      setSellerStripeAccounts(accounts);
    };
    loadSellerStripe();
  }, [items]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => navigate(-1), 300);
  };

  // Check if any items are from paused sellers (should have been filtered at Cart, but double-check)
  const validItems = useMemo(() => 
    items.filter((item: any) => !item.isPaused && item.status !== 'sold'),
    [items]
  );
  
  // Calculate shipping using tiered settings
  const { totalShipping, shippingBySeller } = useMemo(() => {
    return calculateTotalShipping(
      validItems.map(item => ({
        id: item.id,
        sellerId: item.sellerId,
        shippingPrice: item.shippingPrice
      })),
      sellerSettings
    );
  }, [validItems, sellerSettings]);
  
  const itemsTotal = validItems.reduce((sum: number, item: any) => sum + item.price, 0);
  const subtotal = itemsTotal + totalShipping;
  // 2% buyer processing fee (Stripe)
  const processingFee = subtotal * 0.02;
  const total = subtotal + processingFee;
  
  const isShippingComplete = shippingFirstName.trim() && shippingLastName.trim() && shippingAddress.trim() && shippingCity.trim() && shippingState.trim() && shippingPostcode.trim();
  
  if (items.length === 0) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">No items to checkout</p>
        <Button onClick={() => navigate('/cart')} className="mt-4">
          Back to Cart
        </Button>
      </div>;
  }
  
  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error('You must be logged in to place an order');
      return;
    }

    if (isBlocked) {
      toast.error('Your account is restricted. You cannot make purchases.');
      return;
    }
    
    if (!isShippingComplete) {
      toast.error('Please fill in all shipping details');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Save shipping details to sessionStorage for use after Stripe redirect
      const shippingDetails = {
        shippingFirstName: shippingFirstName.trim(),
        shippingLastName: shippingLastName.trim(),
        shippingAddress: shippingAddress.trim(),
        shippingCity: shippingCity.trim(),
        shippingState,
        shippingPostcode: shippingPostcode.trim(),
      };
      sessionStorage.setItem('checkout_shipping', JSON.stringify(shippingDetails));
      sessionStorage.setItem('checkout_items', JSON.stringify(validItems));
      sessionStorage.setItem('checkout_seller_settings', JSON.stringify(Array.from(sellerSettings.entries())));
      sessionStorage.setItem('checkout_shipping_by_seller', JSON.stringify(Array.from(shippingBySeller.entries())));

      // Get the seller's Stripe account ID (for now, assume single seller checkout)
      const sellerId = validItems[0]?.sellerId;
      const sellerStripeAccountId = sellerStripeAccounts.get(sellerId);
      
      if (!sellerStripeAccountId) {
        toast.error('This seller has not connected a payment method yet.');
        setIsSubmitting(false);
        return;
      }

      // Call Stripe Connect checkout edge function (on Cloud project)
      const { data, error } = await cloudSupabase.functions.invoke('stripe-connect-checkout', {
        body: {
          items: validItems.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            image: item.image,
          })),
          shipping: totalShipping,
          userEmail: user.email,
          sellerStripeAccountId,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock saved cards
  const savedCards = [{
    id: 'saved-1',
    lastFour: '9876'
  }];
  return <div className="min-h-screen bg-background">
      <Drawer open={open} onOpenChange={isOpen => !isOpen && handleClose()}>
        <DrawerContent className="max-h-[85vh] bg-background">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background">
            <h1 className="text-center text-xl font-bold text-foreground py-4">Checkout</h1>
          </div>
          
          <div className="overflow-y-auto px-4 pb-8">

            {/* Order Summary Card */}
            <div className="rounded-2xl bg-card overflow-hidden card-shadow">
              {/* Header */}
              <div className="px-4 py-2 text-primary-foreground bg-zinc-300">
                <span className="text-sm text-secondary-foreground">Order Summary</span>
              </div>
              
              {/* Items grouped by seller */}
              <div className="p-4 space-y-4">
                {(() => {
                  // Group items by seller for display
                  const groupedItems = new Map<string, Listing[]>();
                  validItems.forEach(item => {
                    const existing = groupedItems.get(item.sellerId) || [];
                    groupedItems.set(item.sellerId, [...existing, item]);
                  });
                  
                  return Array.from(groupedItems.entries()).map(([sellerId, sellerItems]) => {
                    const shipping = shippingBySeller.get(sellerId) || 0;
                    const thisSellerSettings = sellerSettings.get(sellerId);
                    const isTiered = thisSellerSettings?.tieredEnabled && sellerItems.length > 1;
                    
                    return (
                      <div key={sellerId} className="space-y-3">
                        {sellerItems.map(item => (
                          <div key={item.id} className="flex gap-4">
                            <img src={item.image} alt={item.title} className="h-20 w-20 rounded-xl object-cover" />
                            <div className="flex-1 flex flex-col">
                              <h3 className="font-semibold text-foreground">{item.title}</h3>
                              <div className="flex-1" />
                              <div className="text-right">
                                <p className="text-xl font-bold text-foreground">${item.price}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {/* Show combined shipping for this seller */}
                        <div className="flex justify-between text-sm pl-24">
                          <span className="text-muted-foreground">
                            {isTiered ? `Combined shipping (${sellerItems.length} items)` : 'Shipping'}
                          </span>
                          <span className="text-foreground">+ ${shipping.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              
              {/* Processing fee */}
              <div className="px-4 py-3 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground">Processing fee (2%)</span>
                <span className="text-foreground">+ ${processingFee.toFixed(2)}</span>
              </div>
              
              {/* Total */}
              <div className="bg-charcoal px-4 py-3 flex justify-center">
                <span className="text-white font-medium">Total payment: ${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Shipping Details */}
            <div className="mt-4 rounded-2xl bg-card overflow-hidden card-shadow">
              <div className="px-4 py-2 bg-zinc-300">
                <span className="text-sm text-secondary-foreground">Shipping details</span>
              </div>
              
              {/* Show input fields directly for first-time users (no saved data) */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">First name</label>
                    <Input value={shippingFirstName} onChange={e => setShippingFirstName(e.target.value)} className="h-11 rounded-xl bg-background border-border" placeholder="First name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Last name</label>
                    <Input value={shippingLastName} onChange={e => setShippingLastName(e.target.value)} className="h-11 rounded-xl bg-background border-border" placeholder="Last name" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Street address</label>
                  <Input value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="h-11 rounded-xl bg-background border-border" placeholder="Street address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">City</label>
                  <Input value={shippingCity} onChange={e => setShippingCity(e.target.value)} className="h-11 rounded-xl bg-background border-border" placeholder="City" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Postcode</label>
                    <Input value={shippingPostcode} onChange={e => setShippingPostcode(e.target.value)} className="h-11 rounded-xl bg-background border-border" placeholder="Postcode" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">State</label>
                    <Select value={shippingState} onValueChange={setShippingState}>
                      <SelectTrigger className="h-11 rounded-xl bg-background border-border">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border z-50">
                        <SelectItem value="NSW">NSW</SelectItem>
                        <SelectItem value="VIC">VIC</SelectItem>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="TAS">TAS</SelectItem>
                        <SelectItem value="ACT">ACT</SelectItem>
                        <SelectItem value="NT">NT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <div className="mt-8">
              <Button 
                onClick={handlePlaceOrder} 
                disabled={isSubmitting || !isShippingComplete}
                className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Redirecting to payment...' : 'Proceed to payment'}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                You'll be redirected to Stripe to complete payment securely.
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>;
};
export default Checkout;
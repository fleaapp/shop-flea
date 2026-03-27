import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { Listing } from '@/types/listing';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import applePayBadge from '@/assets/applepay-badge.png';
import gPayBadge from '@/assets/gpay-badge.png';
import cardBadge from '@/assets/card-badge.png';
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

  // Scroll focused input into view when mobile keyboard opens
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);
  const items: Listing[] = location.state?.items || [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(true);
  const [sellerSettings, setSellerSettings] = useState<Map<string, SellerShippingInfo>>(new Map());

  // Shipping details state
  const [shippingFirstName, setShippingFirstName] = useState('');
  const [shippingLastName, setShippingLastName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingSuburb, setShippingSuburb] = useState('');
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

  // Fetch seller payment accounts (Stripe + PayPal)
  const [sellerStripeAccounts, setSellerStripeAccounts] = useState<Map<string, string>>(new Map());
  const [sellerPayPalAccounts, setSellerPayPalAccounts] = useState<Map<string, string>>(new Map());
  const [sellerStripeLoading, setSellerStripeLoading] = useState(true);
  useEffect(() => {
    const loadSellerPayments = async () => {
      if (items.length === 0) { setSellerStripeLoading(false); return; }
      const sellerIds = [...new Set(items.map(item => item.sellerId))];
      
      const { data } = await supabase
        .from('profiles' as any)
        .select('user_id, stripe_account_id, stripe_onboarding_complete, paypal_merchant_id, paypal_onboarding_complete')
        .in('user_id', sellerIds);
      
      const stripeAccounts = new Map<string, string>();
      const paypalAccounts = new Map<string, string>();
      
      data?.forEach((p: any) => {
        if (p.stripe_account_id && p.stripe_onboarding_complete) {
          stripeAccounts.set(p.user_id, p.stripe_account_id);
        }
        if (p.paypal_merchant_id && p.paypal_onboarding_complete) {
          paypalAccounts.set(p.user_id, p.paypal_merchant_id);
        }
      });

      // Real-time Stripe verification for unconfirmed sellers
      const unconfirmedSellerIds = sellerIds.filter(id => !stripeAccounts.has(id));
      
      for (const sellerId of unconfirmedSellerIds) {
        try {
          const dbEntry = data?.find((p: any) => p.user_id === sellerId);
          const { data: statusData, error } = await invokeCloudFunction('stripe-connect-status', {
            stripeAccountId: dbEntry?.stripe_account_id || undefined,
            sellerUserId: sellerId,
          });
          if (!error && statusData && (statusData.chargesEnabled || statusData.detailsSubmitted) && statusData.accountId) {
            stripeAccounts.set(sellerId, statusData.accountId);
          }
        } catch (e) {
          console.error('Seller Stripe verify failed:', e);
        }
      }

      // Real-time PayPal verification for unconfirmed sellers
      const unconfirmedPayPalIds = sellerIds.filter(id => !paypalAccounts.has(id));
      for (const sellerId of unconfirmedPayPalIds) {
        try {
          const { data: statusData, error } = await invokeCloudFunction('paypal-connect-status', {
            sellerUserId: sellerId,
          });
          if (!error && statusData?.connected && statusData?.merchantId) {
            paypalAccounts.set(sellerId, statusData.merchantId);
          }
        } catch (e) {
          console.error('Seller PayPal verify failed:', e);
        }
      }
      
      setSellerStripeAccounts(stripeAccounts);
      setSellerPayPalAccounts(paypalAccounts);
      setSellerStripeLoading(false);
    };
    loadSellerPayments();
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
  
  // Determine which payment method the seller supports
  const sellerId = validItems[0]?.sellerId;
  const sellerHasStripe = sellerId ? sellerStripeAccounts.has(sellerId) : false;
  const sellerHasPayPal = sellerId ? sellerPayPalAccounts.has(sellerId) : false;
  
  // Fee depends on payment method: 2% for Stripe, 3% for PayPal
  // Default to Stripe if both available
  const paymentMethod = sellerHasStripe ? 'stripe' : sellerHasPayPal ? 'paypal' : null;
  const feeRate = paymentMethod === 'paypal' ? 0.03 : 0.02;
  
  const itemsTotal = validItems.reduce((sum: number, item: any) => sum + item.price, 0);
  const subtotal = itemsTotal + totalShipping;
  const processingFee = subtotal * feeRate;
  const total = subtotal + processingFee;
  
  const isShippingComplete = shippingFirstName.trim() && shippingLastName.trim() && shippingAddress.trim() && shippingSuburb.trim() && shippingState.trim() && shippingPostcode.trim();
  
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
        shippingCity: shippingSuburb.trim(),
        shippingState,
        shippingPostcode: shippingPostcode.trim(),
      };
      sessionStorage.setItem('checkout_shipping', JSON.stringify(shippingDetails));
      sessionStorage.setItem('checkout_items', JSON.stringify(validItems));
      sessionStorage.setItem('checkout_seller_settings', JSON.stringify(Array.from(sellerSettings.entries())));
      sessionStorage.setItem('checkout_shipping_by_seller', JSON.stringify(Array.from(shippingBySeller.entries())));

      // Get the seller's payment account
      const sellerId = validItems[0]?.sellerId;
      const sellerStripeAccountId = sellerStripeAccounts.get(sellerId);
      const sellerPayPalMerchantId = sellerPayPalAccounts.get(sellerId);
      
      if (!sellerStripeAccountId && !sellerPayPalMerchantId) {
        toast.error('This seller has not connected a payment method yet.');
        setIsSubmitting(false);
        return;
      }

      // Use Stripe if available, otherwise PayPal
      if (sellerStripeAccountId) {
        const { data, error } = await invokeCloudFunction('stripe-connect-checkout', {
          items: validItems.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            image: item.image,
          })),
          shipping: totalShipping,
          sellerStripeAccountId,
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No checkout URL returned');
        window.location.href = data.url;
      } else if (sellerPayPalMerchantId) {
        sessionStorage.setItem('checkout_payment_method', 'paypal');
        
        const { data, error } = await invokeCloudFunction('paypal-connect-checkout', {
          items: validItems.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            image: item.image,
          })),
          shipping: totalShipping,
          sellerPayPalMerchantId,
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No checkout URL returned');
        window.location.href = data.url;
      }
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
      <Drawer open={open} onOpenChange={isOpen => !isOpen && handleClose()} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[85dvh] bg-background">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background">
            <h1 className="text-center text-xl font-bold text-foreground py-4">Checkout</h1>
          </div>
          
          <div className="overflow-y-auto px-4 pb-8 space-y-4">

            {/* Order Summary Card */}
            <div className="rounded-xl bg-card overflow-hidden">
              <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
                Order Summary
              </div>
              
              {/* Items grouped by seller */}
              <div className="px-4 py-4 space-y-4">
                {(() => {
                  const groupedItems = new Map<string, Listing[]>();
                  validItems.forEach(item => {
                    const existing = groupedItems.get(item.sellerId) || [];
                    groupedItems.set(item.sellerId, [...existing, item]);
                  });
                  
                  return Array.from(groupedItems.entries()).map(([sellerId, sellerItems]) => {
                    const shipping = shippingBySeller.get(sellerId) || 0;
                    
                    return (
                      <div key={sellerId} className="space-y-4">
                        {sellerItems.map((item, idx) => (
                          <div key={item.id} className="flex gap-4">
                            <img src={item.image} alt={item.title} className="h-20 w-20 rounded-xl object-cover bg-muted" />
                            <div className="flex-1 flex flex-col justify-between">
                              <h3 className="font-semibold text-foreground">{item.title}</h3>
                              <div className="text-right">
                                <p className="text-lg font-semibold">${item.price}</p>
                                {idx === sellerItems.length - 1 && (
                                  <p className="text-sm text-muted-foreground">+ ${shipping.toFixed(2)} shipping</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
              
              {/* Fee line */}
              <div className="flex justify-between text-sm px-4 py-3 border-t border-border">
                <span className="text-muted-foreground">Payment processing fee ({Math.round(feeRate * 100)}%)</span>
                <span className="text-muted-foreground">+ ${processingFee.toFixed(2)}</span>
              </div>
              
              {/* Total */}
              <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                <span className="font-medium">Total payment: ${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Shipping Details */}
            <div className="rounded-xl bg-card overflow-hidden">
              <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
                Shipping details
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
                  <AddressAutocomplete
                    value={shippingAddress}
                    onChange={setShippingAddress}
                    onSelect={(addr) => {
                      setShippingAddress(addr.street);
                      if (addr.suburb) setShippingSuburb(addr.suburb);
                      if (addr.state) setShippingState(addr.state);
                      if (addr.postcode) setShippingPostcode(addr.postcode);
                    }}
                    placeholder="Start typing your address..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Suburb</label>
                  <Input value={shippingSuburb} onChange={e => setShippingSuburb(e.target.value)} className="h-11 rounded-xl bg-background border-border" placeholder="Suburb" />
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

            {/* Payment Methods Info */}
            {paymentMethod === 'stripe' && (
              <div className="rounded-xl bg-card overflow-hidden">
                <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
                  Payment
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You'll be able to pay with:
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Apple Pay */}
                    <div className="flex items-center gap-1.5 bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-medium">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                      Pay
                    </div>
                    {/* Google Pay */}
                    <div className="flex items-center gap-1.5 bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-medium">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                      Pay
                    </div>
                    {/* Card */}
                    <div className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5 text-xs font-medium text-foreground">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                      Card
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">
                    All payments are processed securely by Stripe
                  </p>
                </div>
              </div>
            )}

            {/* Confirm Button */}
            <div className="mt-6">
              <Button 
                onClick={handlePlaceOrder} 
                disabled={isSubmitting || !isShippingComplete}
                className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Redirecting to payment...' : 'Proceed to payment'}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                You'll be redirected to {paymentMethod === 'paypal' ? 'PayPal' : 'Stripe'} to complete payment securely.
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>;
};
export default Checkout;
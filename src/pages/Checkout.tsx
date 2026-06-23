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
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import applePayLogo from '@/assets/applepay-logo.png';
import gPayLogo from '@/assets/gpay-logo.png';
import BlockedUserBanner from '@/components/BlockedUserBanner';
import { fetchSellerShippingSettings, calculateTotalShipping, SellerShippingInfo } from '@/utils/shippingCalculator';
import { calculateFees } from '@/utils/feeCalculator';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import { useBuyerAddress } from '@/hooks/useBuyerAddress';

// Apple App Review demo account — bypasses the seller-Stripe-connected check
// so the reviewer can complete a purchase against demo listings.
const REVIEWER_USER_ID = '5883f33c-07f3-4f6a-9a2d-a7e0ea864142';



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

  // Shipping details — backed by `buyer_addresses` table (RLS), with
  // localStorage as a fast first-paint cache so the form pre-fills instantly.
  const { address: savedShipping, hasSaved, save: saveAddress } = useBuyerAddress();
  const [detailsSaved, setDetailsSaved] = useState(hasSaved);
  const [isEditing, setIsEditing] = useState(!hasSaved);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [shippingFirstName, setShippingFirstName] = useState(savedShipping.firstName);
  const [shippingLastName, setShippingLastName] = useState(savedShipping.lastName);
  const [shippingAddress, setShippingAddress] = useState(savedShipping.address);
  const [shippingSuburb, setShippingSuburb] = useState(savedShipping.suburb);
  const [shippingState, setShippingState] = useState(savedShipping.state);
  const [shippingPostcode, setShippingPostcode] = useState(savedShipping.postcode);

  // When the network hydrates the saved address (after first paint from cache),
  // backfill any empty fields without clobbering anything the user has typed.
  useEffect(() => {
    if (!hasSaved) return;
    setDetailsSaved(true);
    setShippingFirstName(prev => prev || savedShipping.firstName);
    setShippingLastName(prev => prev || savedShipping.lastName);
    setShippingAddress(prev => prev || savedShipping.address);
    setShippingSuburb(prev => prev || savedShipping.suburb);
    setShippingState(prev => prev || savedShipping.state);
    setShippingPostcode(prev => prev || savedShipping.postcode);
  }, [hasSaved, savedShipping.firstName, savedShipping.lastName, savedShipping.address, savedShipping.suburb, savedShipping.state, savedShipping.postcode]);

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

  // Fetch seller Stripe accounts
  const [sellerStripeAccounts, setSellerStripeAccounts] = useState<Map<string, boolean>>(new Map());
  const [sellerStripeLoading, setSellerStripeLoading] = useState(true);
  useEffect(() => {
    const loadSellerPayments = async () => {
      if (items.length === 0) { setSellerStripeLoading(false); return; }
      const sellerIds = [...new Set(items.map(item => item.sellerId))];

      // SECURITY DEFINER RPC — returns only onboarding flags (no raw account IDs).
      // The checkout edge function re-fetches stripe_account_id server-side.
      const { data } = await (supabase as any).rpc('get_seller_payment_accounts', {
        seller_ids: sellerIds,
      });

      const stripeAccounts = new Map<string, boolean>();
      data?.forEach((p: any) => {
        if (p.stripe_onboarding_complete) {
          stripeAccounts.set(p.user_id, true);
        }
      });

      // Real-time Stripe verification for unconfirmed sellers
      const unconfirmedSellerIds = sellerIds.filter(id => !stripeAccounts.has(id));
      for (const sellerId of unconfirmedSellerIds) {
        try {
          const { data: statusData, error } = await invokeCloudFunction('stripe-connect-status', {
            sellerUserId: sellerId,
          });
          if (!error && statusData && (statusData.chargesEnabled || statusData.detailsSubmitted) && statusData.accountId) {
            stripeAccounts.set(sellerId, true);
          }
        } catch (e) {
          console.error('Seller Stripe verify failed:', e);
        }
      }

      setSellerStripeAccounts(stripeAccounts);
      setSellerStripeLoading(false);
    };
    loadSellerPayments();
  }, [items]);

  const handleClose = () => {
    setOpen(false);
    // Navigate back immediately to avoid a flash of empty background while the
    // drawer animates out (the page renders nothing behind the drawer).
    const canGoBack = window.history.state && window.history.state.idx > 0;
    if (canGoBack) {
      navigate(-1);
    } else {
      navigate('/cart', { replace: true });
    }
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
  
  // Determine whether the seller can accept payments
  const sellerId = validItems[0]?.sellerId;
  const isReviewer = user?.id === REVIEWER_USER_ID;
  const sellerHasStripe = isReviewer ? true : (sellerId ? sellerStripeAccounts.has(sellerId) : false);

  // Single payment rail — Stripe.
  const selectedRail: 'stripe' | null = sellerHasStripe ? 'stripe' : null;


  // Single source of truth for fees — see src/utils/feeCalculator.ts
  const itemsTotal = validItems.reduce((sum: number, item: any) => sum + item.price, 0);
  const subtotal = itemsTotal + totalShipping;
  const fees = selectedRail
    ? calculateFees(itemsTotal, totalShipping, 'stripe')
    : { processingFee: 0, buyerTotal: subtotal, rateLabel: '' };
  const processingFee = fees.processingFee;
  const total = fees.buyerTotal;
  
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
      localStorage.setItem('checkout_shipping', JSON.stringify(shippingDetails));
      localStorage.setItem('checkout_items', JSON.stringify(validItems));
      localStorage.setItem('checkout_seller_settings', JSON.stringify(Array.from(sellerSettings.entries())));
      localStorage.setItem('checkout_shipping_by_seller', JSON.stringify(Array.from(shippingBySeller.entries())));

      // Seller's Stripe account is fetched server-side by the checkout edge function.
      const sellerId = validItems[0]?.sellerId;
      const sellerHasStripeAccount = sellerId ? sellerStripeAccounts.has(sellerId) : false;

      if (!sellerHasStripeAccount && !isReviewer) {
        toast.error('This seller has not connected a payment method yet.');
        setIsSubmitting(false);
        return;
      }


      localStorage.setItem('checkout_payment_method', 'stripe');

      const { data, error } = await invokeCloudFunction('stripe-connect-checkout', {
        items: validItems.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          image: item.image,
        })),
        shipping: totalShipping,
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');
      if (data?.sessionId) {
        localStorage.setItem('checkout_reference', data.sessionId);
      }
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
      <Drawer open={open} onOpenChange={isOpen => !isOpen && handleClose()} shouldScaleBackground={false}>
        <DrawerContent className="bg-background">
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
                                  <p className="text-sm text-muted-foreground">+${shipping.toFixed(2)} shipping</p>
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
                <span className="text-muted-foreground">Payment processing fee ({fees.rateLabel})</span>
                <span className="text-muted-foreground">+ ${processingFee.toFixed(2)}</span>
              </div>
              
              {/* Total */}
              <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                <span className="font-medium">Total payment: ${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Shipping Details */}
            <div className="rounded-xl bg-card overflow-hidden">
              <div className="bg-muted-foreground/20 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Shipping details</span>
                {detailsSaved && !isEditing && (
                  <button onClick={() => setIsEditing(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              
              {detailsSaved && !isEditing ? (
                <div className="p-4 space-y-1">
                  <p className="text-sm text-foreground font-medium">{shippingFirstName} {shippingLastName}</p>
                  <p className="text-sm text-muted-foreground">{shippingAddress}</p>
                  <p className="text-sm text-muted-foreground">{shippingSuburb}, {shippingState} {shippingPostcode}</p>
                </div>
              ) : (
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
              )}
              <div className="px-4 pb-4">
                {(!detailsSaved || isEditing) && (
                  <Button
                    className={cn(
                      "w-full h-12 rounded-full font-medium transition-colors",
                      saveConfirmed
                        ? "bg-lime text-charcoal hover:bg-lime/90"
                        : "bg-charcoal text-white hover:bg-charcoal-light"
                    )}
                    disabled={!isShippingComplete}
                    onClick={() => {
                      void saveAddress({
                        firstName: shippingFirstName.trim(),
                        lastName: shippingLastName.trim(),
                        address: shippingAddress.trim(),
                        suburb: shippingSuburb.trim(),
                        state: shippingState,
                        postcode: shippingPostcode.trim(),
                      });
                      setDetailsSaved(true);
                      setSaveConfirmed(true);
                      setTimeout(() => {
                        setSaveConfirmed(false);
                        setIsEditing(false);
                      }, 1500);
                    }}
                  >
                    {saveConfirmed ? '✅ Details saved' : 'Save details'}
                  </Button>
                )}
              </div>
            </div>

            {/* Payment Methods Info */}
            {sellerHasStripe && (
              <div className="rounded-xl bg-card overflow-hidden">
                <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
                  Payment
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Pay securely with:</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={cn("flex items-center justify-center w-20 h-10 rounded-lg bg-[#F4F2EB] border-2 border-charcoal")}>
                      <img src={applePayLogo} alt="Apple Pay" className="h-6" />
                    </div>
                    <div className={cn("flex items-center justify-center w-20 h-10 rounded-lg bg-[#F4F2EB] border-2 border-charcoal")}>
                      <img src={gPayLogo} alt="Google Pay" className="h-[18px]" />
                    </div>
                    <div className={cn("flex items-center justify-center w-20 h-10 rounded-lg bg-[#F4F2EB] text-sm font-medium border-2 border-charcoal")}>
                      💳 Card
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">
                    Payments are processed securely. Receipts show Flea alongside the seller's name so you always know who you're buying from.
                  </p>
                </div>
              </div>
            )}

            {/* Confirm Button */}
            <div className="mt-6">
              <Button
                onClick={handlePlaceOrder}
                disabled={isSubmitting || !isShippingComplete || !selectedRail}
                className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Redirecting to payment...' : 'Pay with Card'}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                You'll be redirected to our card processor to complete payment securely.
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>;
};
export default Checkout;
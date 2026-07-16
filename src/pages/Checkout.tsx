import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ApplePayEventsEnum, GooglePayEventsEnum, Stripe } from '@capacitor-community/stripe';
import type { CanMakePaymentResult, PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';

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
import { Pencil, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import BlockedUserBanner from '@/components/BlockedUserBanner';
import { fetchSellerShippingSettings, calculateTotalShipping, SellerShippingInfo } from '@/utils/shippingCalculator';
import { calculateFees } from '@/utils/feeCalculator';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import { useBuyerAddress } from '@/hooks/useBuyerAddress';
import SecureCheckoutInfoPopover from '@/components/SecureCheckoutInfoPopover';
import CouponInput, { AppliedCoupon } from '@/components/CouponInput';
import PaymentMethodPicker, { SelectedPaymentMethod } from '@/components/checkout/PaymentMethodPicker';
import CardDetailsSheet from '@/components/checkout/CardDetailsSheet';
import { getStripe } from '@/lib/stripe/loadStripe';
import visaLogo from '@/assets/cards/visa.svg';
import mastercardLogo from '@/assets/cards/mastercard.svg';
import amexLogo from '@/assets/cards/amex.svg';
import applePayLogo from '@/assets/cards/apple-pay.svg';

// Apple App Review demo account — bypasses the seller-Stripe-connected check
// so the reviewer can complete a purchase against demo listings.
const REVIEWER_USER_ID = '5883f33c-07f3-4f6a-9a2d-a7e0ea864142';
const APPLE_PAY_MERCHANT_ID = import.meta.env.VITE_APPLE_PAY_MERCHANT_ID || 'merchant.com.finditonflea.app';

const getNativeWalletPlatform = (): 'ios' | 'android' | null => {
  if (!Capacitor.isNativePlatform()) return null;
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return platform;
  return null;
};



const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const buyerOwesCents = Number((profile as any)?.negative_balance_cents ?? 0);
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
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

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
  const rawFees = selectedRail
    ? calculateFees(itemsTotal, totalShipping, 'stripe')
    : { processingFee: 0, buyerTotal: subtotal, rateLabel: '' };
  const feeWaived = coupon?.type === 'waive_buyer_fee';
  const processingFee = feeWaived ? 0 : rawFees.processingFee;
  const originalFee = rawFees.processingFee;
  const total = subtotal + processingFee;
  
  const isShippingComplete = shippingFirstName.trim() && shippingLastName.trim() && shippingAddress.trim() && shippingSuburb.trim() && shippingState.trim() && shippingPostcode.trim();
  
  // In-app payment state
  const [selectedMethod, setSelectedMethod] = useState<SelectedPaymentMethod | null>(null);
  const [cardSheetOpen, setCardSheetOpen] = useState(false);

  /** Persist buyer-side context to localStorage so CheckoutSuccess can finalize orders. */
  const persistCheckoutContext = useCallback(() => {
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
    localStorage.setItem('checkout_payment_method', 'stripe');
  }, [shippingFirstName, shippingLastName, shippingAddress, shippingSuburb, shippingState, shippingPostcode, validItems, sellerSettings, shippingBySeller]);

  /** Server-authoritative PaymentIntent creation. */
  const createPaymentIntent = useCallback(async (saveCard: boolean) => {
    const { data, error } = await invokeCloudFunction('stripe-connect-payment-intent', {
      items: validItems.map(item => ({ id: item.id, title: item.title, price: item.price, image: item.image })),
      shipping: totalShipping,
      couponCode: coupon?.code ?? null,
      saveCard,
    });
    if (error) throw error;
    if (data?.demo) {
      // Reviewer bypass — orders inserted server-side; short-circuit to success.
      localStorage.setItem('checkout_reference', data.checkoutReference);
      window.location.href = `/checkout/success?demo=1&order_group=${data.orderGroupId}`;
      return null;
    }
    if (!data?.clientSecret || !data?.paymentIntentId) throw new Error('Payment initialization failed');
    localStorage.setItem('checkout_reference', data.paymentIntentId);
    return data as {
      clientSecret: string;
      paymentIntentId: string;
      amount: number;
      publishableKey: string;
      merchantDisplayName?: string;
    };
  }, [validItems, totalShipping, coupon]);

  if (items.length === 0) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">No items to checkout</p>
        <Button onClick={() => navigate('/cart')} className="mt-4">
          Back to Cart
        </Button>
      </div>;
  }

  const preflight = () => {
    if (!user) { toast.error('You must be logged in to place an order'); return false; }
    if (isBlocked) { toast.error('Your account is restricted. You cannot make purchases.'); return false; }
    if (buyerOwesCents > 0) {
      toast.error(`Settle your seller balance ($${(buyerOwesCents / 100).toFixed(2)}) in Seller Dashboard before making new purchases.`);
      return false;
    }
    if (!isShippingComplete) { toast.error('Please fill in all shipping details'); return false; }
    if (!sellerHasStripe) { toast.error('This seller has not connected a payment method yet.'); return false; }
    return true;
  };

  /** Handle successful confirmation (any method). */
  const handlePaymentSuccess = (paymentIntentId: string) => {
    setCardSheetOpen(false);
    localStorage.setItem('checkout_reference', paymentIntentId);
    navigate(`/checkout/success?payment_intent=${paymentIntentId}`);
  };

  const handleNativeWalletConfirm = async (pi: {
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    publishableKey: string;
    merchantDisplayName?: string;
  }) => {
    const platform = getNativeWalletPlatform();
    if (!platform) return false;

    await Stripe.initialize({ publishableKey: pi.publishableKey });

    if (platform === 'ios') {
      try {
        await Stripe.isApplePayAvailable();
      } catch {
        toast.error('Apple Pay is not available on this device. Please choose Add new card.');
        return true;
      }

      await Stripe.createApplePay({
        paymentIntentClientSecret: pi.clientSecret,
        merchantIdentifier: APPLE_PAY_MERCHANT_ID,
        countryCode: 'AU',
        currency: 'AUD',
        paymentSummaryItems: [
          {
            label: pi.merchantDisplayName || 'Flea',
            amount: Number((pi.amount / 100).toFixed(2)),
          },
        ],
        allowedCountries: ['au'],
        allowedCountriesErrorDescription: 'Flea is currently available in Australia only.',
      });

      const { paymentResult } = await Stripe.presentApplePay();
      if (paymentResult === ApplePayEventsEnum.Completed) {
        handlePaymentSuccess(pi.paymentIntentId);
      } else if (paymentResult === ApplePayEventsEnum.Canceled) {
        toast.message('Payment was cancelled.');
      } else {
        toast.error('Payment did not complete. Please try again.');
      }
      return true;
    }

    try {
      await Stripe.isGooglePayAvailable();
    } catch {
      toast.error('Google Pay is not available on this device. Please choose Add new card.');
      return true;
    }

    await Stripe.createGooglePay({
      paymentIntentClientSecret: pi.clientSecret,
    });

    const { paymentResult } = await Stripe.presentGooglePay();
    if (paymentResult === GooglePayEventsEnum.Completed) {
      handlePaymentSuccess(pi.paymentIntentId);
    } else if (paymentResult === GooglePayEventsEnum.Canceled) {
      toast.message('Payment was cancelled.');
    } else {
      toast.error('Payment did not complete. Please try again.');
    }
    return true;
  };

  const walletIsAvailable = (result: CanMakePaymentResult | null, wallet: 'apple' | 'google') => {
    if (!result) return false;
    return wallet === 'apple' ? Boolean(result.applePay) : Boolean(result.googlePay);
  };

  const handleWebWalletConfirm = async () => {
    if (selectedMethod?.kind !== 'wallet') return false;
    const stripe = await getStripe();
    if (!stripe) throw new Error('Payment provider failed to load');

    const amountCents = Math.round(total * 100);
    const paymentRequest = stripe.paymentRequest({
      country: 'AU',
      currency: 'aud',
      total: { label: 'Flea', amount: amountCents },
      displayItems: [
        { label: 'Items', amount: Math.round(itemsTotal * 100) },
        ...(totalShipping > 0 ? [{ label: 'Shipping', amount: Math.round(totalShipping * 100) }] : []),
        ...(processingFee > 0 ? [{ label: 'Secure Checkout Fee', amount: Math.round(processingFee * 100) }] : []),
      ],
      requestPayerName: true,
      requestPayerEmail: true,
    });

    const canPay = await paymentRequest.canMakePayment();
    if (!walletIsAvailable(canPay, selectedMethod.wallet)) {
      toast.error(`${selectedMethod.wallet === 'apple' ? 'Apple Pay' : 'Google Pay'} is not available here. Please choose Add new card.`);
      return true;
    }

    await new Promise<void>((resolve, reject) => {
      let paymentStarted = false;

      paymentRequest.on('paymentmethod', async (event: PaymentRequestPaymentMethodEvent) => {
        paymentStarted = true;
        try {
          const pi = await createPaymentIntent(false);
          if (!pi) {
            event.complete('fail');
            resolve();
            return;
          }

          const { error, paymentIntent } = await stripe.confirmCardPayment(
            pi.clientSecret,
            { payment_method: event.paymentMethod.id },
            { handleActions: false }
          );

          if (error) {
            event.complete('fail');
            reject(error);
            return;
          }

          event.complete('success');

          if (paymentIntent?.status === 'requires_action') {
            const actionResult = await stripe.confirmCardPayment(pi.clientSecret);
            if (actionResult.error) {
              reject(actionResult.error);
              return;
            }
            if (actionResult.paymentIntent?.status === 'succeeded' || actionResult.paymentIntent?.status === 'requires_capture') {
              handlePaymentSuccess(actionResult.paymentIntent.id);
              resolve();
              return;
            }
          }

          if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
            handlePaymentSuccess(paymentIntent.id);
            resolve();
          } else {
            reject(new Error('Payment did not complete. Please try again.'));
          }
        } catch (error) {
          event.complete('fail');
          reject(error);
        }
      });

      paymentRequest.on('cancel', () => {
        if (!paymentStarted) resolve();
      });

      try {
        paymentRequest.show();
      } catch (error) {
        reject(error);
      }
    });

    return true;
  };

  /** Confirm with a card the user JUST entered in the Vinted-style sheet. */
  const handleCardConfirm = async ({ paymentMethodId, saveCard }: { paymentMethodId: string; cardholderName: string; saveCard: boolean }) => {
    if (!preflight()) return;
    persistCheckoutContext();
    setIsSubmitting(true);
    try {
      const pi = await createPaymentIntent(saveCard);
      if (!pi) return;
      const stripe = await getStripe();
      if (!stripe) throw new Error('Stripe failed to load');
      const { error, paymentIntent } = await stripe.confirmCardPayment(pi.clientSecret, {
        payment_method: paymentMethodId,
      });
      if (error) {
        toast.error(error.message || 'Card was declined. Please try another card.');
        return;
      }
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        handlePaymentSuccess(paymentIntent.id);
      } else {
        toast.error('Payment did not complete. Please try again.');
      }
    } catch (e: any) {
      console.error('card confirm error:', e);
      toast.error(e?.message || 'Failed to process card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Confirm with a saved card the user picked from the list. */
  const handleSavedCardConfirm = async (paymentMethodId: string) => {
    if (!preflight()) return;
    persistCheckoutContext();
    setIsSubmitting(true);
    try {
      const pi = await createPaymentIntent(false);
      if (!pi) return;
      const stripe = await getStripe();
      if (!stripe) throw new Error('Stripe failed to load');
      const { error, paymentIntent } = await stripe.confirmCardPayment(pi.clientSecret, {
        payment_method: paymentMethodId,
      });
      if (error) {
        toast.error(error.message || 'Payment failed. Please try another method.');
        return;
      }
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        handlePaymentSuccess(paymentIntent.id);
      } else {
        toast.error('Payment did not complete. Please try again.');
      }
    } catch (e: any) {
      console.error('saved card confirm error:', e);
      toast.error(e?.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Start Apple/Google Pay directly. Native uses the Capacitor sheet, web uses the browser wallet sheet. */
  const handleWalletTap = async () => {
    if (!preflight()) return;
    persistCheckoutContext();
    setIsSubmitting(true);
    try {
      if (getNativeWalletPlatform()) {
        const pi = await createPaymentIntent(false);
        if (!pi) return;
        await handleNativeWalletConfirm(pi);
        return;
      }

      await handleWebWalletConfirm();
    } catch (e: any) {
      console.error('wallet init error:', e);
      toast.error(e?.message || 'Failed to start payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Master Pay button — dispatches by selected method. */
  const handlePayClick = () => {
    if (!selectedMethod) { toast.error('Please pick a payment method.'); return; }
    switch (selectedMethod.kind) {
      case 'wallet':   handleWalletTap(); break;
      case 'saved':    handleSavedCardConfirm(selectedMethod.card.id); break;
      case 'new_card': setCardSheetOpen(true); break;
    }
  };

  const payButtonLabel = () => {
    if (isSubmitting) return 'Processing...';
    if (!selectedMethod) return 'Confirm order';
    switch (selectedMethod.kind) {
      case 'wallet':
        return selectedMethod.wallet === 'google' ? 'Buy with Google Pay' : 'Buy with Apple Pay';
      case 'saved': return `Pay $${total.toFixed(2)}`;
      case 'new_card': return 'Continue to card details';
    }
  };

  return <div className="min-h-screen bg-background">
      <Drawer open={open} onOpenChange={isOpen => !isOpen && handleClose()} shouldScaleBackground={false}>
        <DrawerContent className="bg-background">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background">
            <h1 className="text-center text-xl font-bold text-foreground py-4">Checkout</h1>
          </div>
          
          <div className="overflow-y-auto px-4 pb-8 space-y-4">

            {buyerOwesCents > 0 && (
              <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4">
                <p className="text-[13px] font-semibold text-destructive mb-1">Outstanding seller balance</p>
                <p className="text-[12px] text-charcoal/80 leading-relaxed">
                  You owe ${(buyerOwesCents / 100).toFixed(2)} from refunds or disputes on your sales. Settle it in your Seller Dashboard before making new purchases.
                </p>
                <Button
                  onClick={() => navigate('/seller-dashboard')}
                  className="mt-3 h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[13px] font-semibold"
                >
                  Go to Seller Dashboard
                </Button>
              </div>
            )}


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
              
              {/* Coupon input */}
              <div className="px-4 py-3 border-t border-border">
                <CouponInput value={coupon} onChange={setCoupon} />
              </div>

              {/* Fee line */}
              <div className="flex justify-between text-sm px-4 py-3 border-t border-border">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  Secure Checkout Fee ({rawFees.rateLabel})
                  <SecureCheckoutInfoPopover />
                </span>
                {feeWaived ? (
                  <span className="text-charcoal font-medium">
                    <span className="line-through text-muted-foreground mr-1.5">+ ${originalFee.toFixed(2)}</span>
                    $0.00
                  </span>
                ) : (
                  <span className="text-muted-foreground">+ ${processingFee.toFixed(2)}</span>
                )}
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

            {/* Payment method picker (Depop-style) */}
            {sellerHasStripe && (
              <PaymentMethodPicker
                value={selectedMethod}
                onChange={setSelectedMethod}
                amountCents={Math.round(total * 100)}
              />
            )}

            {/* Master Pay button */}
            <div className="mt-6">
              <Button
                onClick={handlePayClick}
                disabled={isSubmitting || !isShippingComplete || !sellerHasStripe || !selectedMethod || buyerOwesCents > 0}
                className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light font-medium disabled:opacity-50"
              >
                {buyerOwesCents > 0 ? 'Settle balance to buy' : payButtonLabel()}
              </Button>
              <p className="text-[11px] text-muted-foreground/70 text-center mt-5 flex items-center justify-center gap-1">
                <Lock size={11} /> Payments are encrypted and are processed by Stripe.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <img src={applePayLogo} alt="Apple Pay" className="h-6 w-auto rounded-[3px]" />
                <img src={visaLogo} alt="Visa" className="h-6 w-auto rounded-[3px]" />
                <img src={mastercardLogo} alt="Mastercard" className="h-6 w-auto rounded-[3px]" />
                <img src={amexLogo} alt="American Express" className="h-6 w-auto rounded-[3px]" />
              </div>
            </div>
          </div>

          {/* Vinted-style card details drawer */}
          <CardDetailsSheet
            open={cardSheetOpen}
            onClose={() => setCardSheetOpen(false)}
            onConfirm={handleCardConfirm}
          />
        </DrawerContent>
      </Drawer>
    </div>;
};
export default Checkout;
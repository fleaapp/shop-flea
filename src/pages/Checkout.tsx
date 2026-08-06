import { safeNavigateBack } from '@/utils/safeBack';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSnapshotDraft } from '@/hooks/useSnapshotDraft';
import { offerTimeLeft } from '@/hooks/useOffers';

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
import { Pencil, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import BlockedUserBanner from '@/components/BlockedUserBanner';
import { fetchSellerShippingSettings, calculateTotalShipping, calculateTotalItemDiscount, getBundleBreakdownText, SellerShippingInfo } from '@/utils/shippingCalculator';
import { calculateFees } from '@/utils/feeCalculator';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
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
import { mapCardDeclineMessage, logCardDecline } from '@/lib/cardDeclineHandler';
import { categoriseApplePayError, logApplePayDiagnostic, runApplePayPreflight } from '@/lib/applePayDiagnostics';

// The Apple App Review demo bypass lives server-side only (profiles.is_apple_reviewer).
// Nothing identifying it is shipped in the client bundle.
const APPLE_PAY_MERCHANT_ID = import.meta.env.VITE_APPLE_PAY_MERCHANT_ID || 'merchant.com.finditonflea.app';

const isNative = () => Capacitor.isNativePlatform();

const getNativeWalletPlatform = () => {
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
  const isOnline = useOnlineStatus();
  const {
    cartItems,
    offerPricingError,
    refetch: refetchCart,
    removeFromCart,
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
  const routeItems: Listing[] = location.state?.items || [];
  const checkoutItemIds = useMemo(() => routeItems.map((item) => item.id), [routeItems]);
  const liveCheckoutItems = useMemo(
    () => cartItems.filter((item) => checkoutItemIds.includes(item.id)),
    [cartItems, checkoutItemIds],
  );
  const items: Listing[] = liveCheckoutItems.length > 0 ? liveCheckoutItems : routeItems;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(true);
  const [sellerSettings, setSellerSettings] = useState<Map<string, SellerShippingInfo>>(new Map());
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  useEffect(() => {
    void refetchCart();
  }, [refetchCart]);

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

  // Seller payment status is enforced at listing time and again server-side
  // by the payment-intent function. Checkout does not re-check it, so the
  // payment method picker always renders immediately.

  const handleClose = () => {
    setOpen(false);
    // Navigate back immediately to avoid a flash of empty background while the
    // drawer animates out (the page renders nothing behind the drawer).
    const canGoBack = window.history.state && window.history.state.idx > 0;
    if (canGoBack) {
      safeNavigateBack(navigate, "/cart");
    } else {
      navigate('/cart', { replace: true });
    }
  };

  // Check if any items are from paused/inactive/removed sellers (should have been filtered at Cart, but double-check)
  const validItems = useMemo(() =>
    items.filter((item: any) => !item.isPaused && !item.isInactive && !item.isRemoved && item.status !== 'sold'),
    [items]
  );

  // Anything dropped from the payable list gets named back to the buyer so a
  // vanishing item never looks like a bug in the total.
  const unavailableItems = useMemo(
    () =>
      (items as any[])
        .filter((item) => item.isPaused || item.isInactive || item.isRemoved || item.status === 'sold')
        .map((item) => ({
          id: item.id,
          title: item.title as string,
          reason:
            item.status === 'sold'
              ? 'sold while it was in your cart'
              : item.isRemoved
                ? 'was removed by the seller'
                : 'is unavailable right now',
        })),
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
  
  // Seller is verified at listing time; checkout always uses the Stripe rail.
  // Server-side payment-intent validation is the final safety net.
  const sellerHasStripe = true;

  // Bundle offers: item-level discount when a seller offers "% off bundles".
  const { totalDiscount: bundleItemDiscount, discountBySeller } = useMemo(
    () =>
      calculateTotalItemDiscount(
        validItems.map((item: any) => ({
          sellerId: item.sellerId,
          price: Number(item.price) || 0,
          hasAcceptedOffer: item.offerPrice !== undefined,
        })),
        sellerSettings
      ),
    [validItems, sellerSettings]
  );

  // Single source of truth for fees — see src/utils/feeCalculator.ts
  const rawItemsTotal = validItems.reduce((sum: number, item: any) => sum + item.price, 0);
  const itemsTotal = Math.round((rawItemsTotal - bundleItemDiscount) * 100) / 100;
  const subtotal = itemsTotal + totalShipping;
  const rawFees = calculateFees(itemsTotal, totalShipping, 'stripe');
  const feeWaived = coupon?.type === 'waive_buyer_fee';
  const processingFee = feeWaived ? 0 : rawFees.processingFee;
  const originalFee = rawFees.processingFee;
  const total = subtotal + processingFee;
  
  const isShippingComplete = shippingFirstName.trim() && shippingLastName.trim() && shippingAddress.trim() && shippingSuburb.trim() && shippingState.trim() && shippingPostcode.trim();
  
  // In-app payment state
  const [selectedMethod, setSelectedMethod] = useState<SelectedPaymentMethod | null>(null);
  const [cardSheetOpen, setCardSheetOpen] = useState(false);
  // Persistent, on-screen checkout error. Toasts get clipped or dismissed by
  // native payment sheets, so every failure path also writes here so the
  // buyer (and we) can see exactly what happened after the sheet closes.
  const [checkoutError, setCheckoutError] = useState<{
    stage: string;
    message: string;
    code?: string;
    ref?: string;
  } | null>(null);
  const showCheckoutError = useCallback((
    stage: string,
    message: string,
    extra?: { code?: string; ref?: string },
  ) => {
    setCheckoutError({ stage, message, code: extra?.code, ref: extra?.ref });
    try { toast.error(message); } catch {}
  }, []);


  // Persist in-progress checkout selections so backgrounding the app (e.g.
  // hopping out to grab card details) doesn't reset the coupon, chosen
  // payment method, or open card sheet on return.
  const checkoutDraftKey = user ? `flea_draft_checkout_v1_${user.id}` : null;
  const checkoutSnapshot = useMemo(() => ({
    coupon,
    selectedMethod,
    cardSheetOpen,
    isEditing,
  }), [coupon, selectedMethod, cardSheetOpen, isEditing]);
  const { clear: clearCheckoutDraft } = useSnapshotDraft(
    checkoutDraftKey,
    checkoutSnapshot,
    (saved) => {
      if (!saved || typeof saved !== 'object') return;
      if (saved.coupon !== undefined) setCoupon(saved.coupon);
      if (saved.selectedMethod !== undefined) setSelectedMethod(saved.selectedMethod);
      if (typeof saved.cardSheetOpen === 'boolean') setCardSheetOpen(saved.cardSheetOpen);
      if (typeof saved.isEditing === 'boolean') setIsEditing(saved.isEditing);
    },
  );

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
      items: validItems.map(item => ({ id: item.id, sellerId: item.sellerId, title: item.title, price: item.price, image: item.image })),
      shipping: totalShipping,
      shippingBySeller: Array.from(shippingBySeller.entries()),
      expectedAmountCents: Math.round(total * 100),
      couponCode: coupon?.code ?? null,
      saveCard,
    });
    if (error) {
      const code = (error as any).code as string | undefined;
      const status = (error as any).status as number | undefined;
      showCheckoutError('create-payment-intent', error.message, {
        code: code || (status ? `http_${status}` : undefined),
      });
      if (code === 'checkout_amount_mismatch' || status === 409) {
        await refetchCart();
      }
      throw error;
    }
    if (data?.demo) {
      // Reviewer bypass — orders inserted server-side; short-circuit to success.
      localStorage.setItem('checkout_reference', data.checkoutReference);
      window.location.href = `/checkout/success?demo=1&order_group=${data.orderGroupId}`;
      return null;
    }
    if (!data?.clientSecret || !data?.paymentIntentId) {
      const msg = 'Payment initialization failed. Please try again.';
      showCheckoutError('create-payment-intent', msg, { code: 'no_client_secret' });
      throw new Error(msg);
    }
    localStorage.setItem('checkout_reference', data.paymentIntentId);
    if (coupon?.code) {
      localStorage.setItem('checkout_coupon_code', coupon.code);
    } else {
      localStorage.removeItem('checkout_coupon_code');
    }
    return data as {
      clientSecret: string;
      paymentIntentId: string;
      amount: number;
      publishableKey: string;
      livemode?: boolean;
      sellerAccountId?: string;
      clientStripeAccountId?: string | null;
      ephemeralKey?: string;
      customerId?: string;
      merchantDisplayName?: string;
    };
  }, [validItems, totalShipping, shippingBySeller, total, coupon, showCheckoutError, refetchCart]);




  if (items.length === 0) {
    return <div className="native-safe-top min-h-dvh bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">No items to checkout</p>
        <Button onClick={() => navigate('/cart')} className="mt-4">
          Back to Cart
        </Button>
      </div>;
  }

  const preflight = () => {
    if (!isOnline) {
      showCheckoutError('offline', "You're offline, so we couldn't reach the network. Your card has not been charged - reconnect and try again.");
      return false;
    }
    if (!user) { toast.error('You must be logged in to place an order'); return false; }
    if (offerPricingError) {
      showCheckoutError('offer-price-verification', offerPricingError, { code: 'offer_price_unverified' });
      return false;
    }
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
    clearCheckoutDraft();
    navigate(`/checkout/success?payment_intent=${paymentIntentId}`);
  };

  /** Native wallet confirmation. iOS uses Stripe's direct Apple Pay bridge, so
   * checkout never opens the provider's combined payment sheet. */
  const handleNativeWalletConfirm = async (pi: {
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    publishableKey: string;
    livemode?: boolean;
    sellerAccountId?: string;
    clientStripeAccountId?: string | null;
    merchantDisplayName?: string;
  }) => {
    const platform = getNativeWalletPlatform();
    if (!platform) return false;

    if (!pi.publishableKey) {
      showCheckoutError('config', 'Payment provider is not configured. Please contact support.', { code: 'no_publishable_key' });
      return true;
    }

    const publishableKeyMode = pi.publishableKey.startsWith('pk_live_') ? 'live' : 'test';
    if (typeof pi.livemode === 'boolean' && pi.livemode !== (publishableKeyMode === 'live')) {
      const message = 'Payment provider is misconfigured. Please choose Add new card or contact support.';
      void logApplePayDiagnostic('key mode mismatch', {
        ok: false,
        code: 'unknown',
        userMessage: message,
        raw: `PaymentIntent mode ${pi.livemode ? 'live' : 'test'} does not match publishable key mode ${publishableKeyMode}.`,
      }, {
        merchantId: APPLE_PAY_MERCHANT_ID,
        publishableKeyMode,
        paymentIntentMode: pi.livemode ? 'live' : 'test',
        sellerAccountSuffix: pi.sellerAccountId?.slice(-4) ?? null,
      });
      showCheckoutError('apple-pay-config', message, { code: 'mode_mismatch', ref: pi.paymentIntentId });
      return true;
    }

    try {
      await Stripe.initialize({
        publishableKey: pi.publishableKey,
        ...(pi.clientStripeAccountId ? { stripeAccount: pi.clientStripeAccountId } : {}),
      });
    } catch (e: any) {
      console.error('[NativeWallet] initialize failed', e);
      const message = e?.message || 'Failed to start payment. Please try again.';
      void logCardDecline({
        where: 'native-wallet-initialize',
        error: { code: 'sdk_initialize_failed', message },
        paymentIntentId: pi.paymentIntentId,
        amountCents: pi.amount,
      });
      showCheckoutError('sdk-initialize', message, { code: 'sdk_initialize_failed', ref: pi.paymentIntentId });
      return true;
    }

    if (platform === 'ios') {
      const preflight = await runApplePayPreflight(APPLE_PAY_MERCHANT_ID);
      console.info('[ApplePay] preflight', {
        preflight,
        merchantId: APPLE_PAY_MERCHANT_ID,
        clientStripeAccountSuffix: pi.clientStripeAccountId?.slice(-4) ?? null,
        publishableKeyMode,
        paymentIntentMode: typeof pi.livemode === 'boolean' ? (pi.livemode ? 'live' : 'test') : 'unknown',
        sellerAccountSuffix: pi.sellerAccountId?.slice(-4) ?? null,
      });

      if (!preflight.ok) {
        void logApplePayDiagnostic('preflight failed', preflight, {
          merchantId: APPLE_PAY_MERCHANT_ID,
          clientStripeAccountSuffix: pi.clientStripeAccountId?.slice(-4) ?? null,
          publishableKeyMode,
          paymentIntentMode: typeof pi.livemode === 'boolean' ? (pi.livemode ? 'live' : 'test') : 'unknown',
          sellerAccountSuffix: pi.sellerAccountId?.slice(-4) ?? null,
        });
        showCheckoutError('apple-pay-preflight', preflight.userMessage, { code: preflight.code, ref: pi.paymentIntentId });
        return true;
      }

      let nativeFailureMessage = '';
      const failedHandle = await Stripe.addListener(ApplePayEventsEnum.Failed, (error: any) => {
        nativeFailureMessage = typeof error === 'string'
          ? error
          : String(error?.error || error?.message || JSON.stringify(error || {}));
        const diag = categoriseApplePayError(nativeFailureMessage);
        console.error('[ApplePay] native failed event', { nativeFailureMessage, merchantId: APPLE_PAY_MERCHANT_ID });
        void logApplePayDiagnostic('native failed event', diag, {
          merchantId: APPLE_PAY_MERCHANT_ID,
          clientStripeAccountSuffix: pi.clientStripeAccountId?.slice(-4) ?? null,
          publishableKeyMode,
          paymentIntentMode: typeof pi.livemode === 'boolean' ? (pi.livemode ? 'live' : 'test') : 'unknown',
          sellerAccountSuffix: pi.sellerAccountId?.slice(-4) ?? null,
        });
      });

      try {
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
      } catch (err: any) {
        const diag = categoriseApplePayError(err);
        const message = diag.userMessage;
        console.error('[ApplePay] createApplePay failed', err);
        void logApplePayDiagnostic('create failed', diag, {
          merchantId: APPLE_PAY_MERCHANT_ID,
          clientStripeAccountSuffix: pi.clientStripeAccountId?.slice(-4) ?? null,
          publishableKeyMode,
          paymentIntentMode: typeof pi.livemode === 'boolean' ? (pi.livemode ? 'live' : 'test') : 'unknown',
          sellerAccountSuffix: pi.sellerAccountId?.slice(-4) ?? null,
        });
        void failedHandle.remove();
        showCheckoutError('apple-pay-create', message, { code: 'create_apple_pay_failed', ref: pi.paymentIntentId });
        return true;
      }

      try {
        const { paymentResult } = await Stripe.presentApplePay();
        if (paymentResult === ApplePayEventsEnum.Completed) {
          handlePaymentSuccess(pi.paymentIntentId);
        } else if (paymentResult === ApplePayEventsEnum.Canceled) {
          toast.message('Payment was cancelled.');
        } else {
          const message = nativeFailureMessage || 'Payment did not complete. Please try again.';
          void logApplePayDiagnostic('present returned failed', {
            ok: false,
            code: 'unknown',
            userMessage: message,
            raw: nativeFailureMessage || paymentResult,
          }, {
            merchantId: APPLE_PAY_MERCHANT_ID,
            paymentResult,
            publishableKeyMode,
            paymentIntentMode: typeof pi.livemode === 'boolean' ? (pi.livemode ? 'live' : 'test') : 'unknown',
            sellerAccountSuffix: pi.sellerAccountId?.slice(-4) ?? null,
          });
          showCheckoutError('apple-pay-present', message, { code: String(paymentResult), ref: pi.paymentIntentId });
        }
      } catch (err: any) {
        const diag = categoriseApplePayError(err);
        const message = diag.userMessage;
        console.error('[ApplePay] presentApplePay failed', err);
        void logApplePayDiagnostic('present threw', diag, {
          merchantId: APPLE_PAY_MERCHANT_ID,
          publishableKeyMode,
          paymentIntentMode: typeof pi.livemode === 'boolean' ? (pi.livemode ? 'live' : 'test') : 'unknown',
          sellerAccountSuffix: pi.sellerAccountId?.slice(-4) ?? null,
        });
        showCheckoutError('apple-pay-present', message, { code: 'present_apple_pay_failed', ref: pi.paymentIntentId });
      } finally {
        void failedHandle.remove();
      }
      return true;
    }

    try {
      await Stripe.isGooglePayAvailable();
    } catch {
      showCheckoutError('google-pay-availability', 'Google Pay is not available on this device. Please choose Add new card.', { code: 'google_pay_unavailable', ref: pi.paymentIntentId });
      return true;
    }

    try {
      await Stripe.createGooglePay({ paymentIntentClientSecret: pi.clientSecret });
      const { paymentResult } = await Stripe.presentGooglePay();
      if (paymentResult === GooglePayEventsEnum.Completed) {
        handlePaymentSuccess(pi.paymentIntentId);
      } else if (paymentResult === GooglePayEventsEnum.Canceled) {
        toast.message('Payment was cancelled.');
      } else {
        showCheckoutError('google-pay-present', 'Payment did not complete. Please try again.', { code: String(paymentResult), ref: pi.paymentIntentId });
      }
    } catch (err: any) {
      showCheckoutError('google-pay-present', err?.message || 'Payment did not complete. Please try again.', { code: (err as any)?.code, ref: pi.paymentIntentId });
    };
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
    setCheckoutError(null);
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
        void logCardDecline({ where: 'manual-card', error: error as any, paymentIntentId: pi.paymentIntentId, amountCents: pi.amount });
        showCheckoutError('confirm-card', mapCardDeclineMessage(error as any), { code: (error as any)?.decline_code || (error as any)?.code, ref: pi.paymentIntentId });
        return;
      }
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        handlePaymentSuccess(paymentIntent.id);
      } else {
        showCheckoutError('confirm-card', 'Payment did not complete. Please try again.', { code: paymentIntent?.status, ref: paymentIntent?.id });
      }
    } catch (e: any) {
      console.error('card confirm error:', e);
      showCheckoutError('confirm-card', e?.message || 'Failed to process card. Please try again.', { code: (e as any)?.code });
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Confirm with a saved card the user picked from the list. */
  const handleSavedCardConfirm = async (paymentMethodId: string) => {
    if (!preflight()) return;
    setCheckoutError(null);
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
        void logCardDecline({ where: 'saved-card', error: error as any, paymentIntentId: pi.paymentIntentId, amountCents: pi.amount });
        showCheckoutError('confirm-saved-card', mapCardDeclineMessage(error as any), { code: (error as any)?.decline_code || (error as any)?.code, ref: pi.paymentIntentId });
        return;
      }
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        handlePaymentSuccess(paymentIntent.id);
      } else {
        showCheckoutError('confirm-saved-card', 'Payment did not complete. Please try again.', { code: paymentIntent?.status, ref: paymentIntent?.id });
      }
    } catch (e: any) {
      console.error('saved card confirm error:', e);
      showCheckoutError('confirm-saved-card', e?.message || 'Failed to process payment. Please try again.', { code: (e as any)?.code });
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Start Apple/Google Pay directly. Native uses the Capacitor sheet, web uses the browser wallet sheet. */
  const handleWalletTap = async () => {
    if (!preflight()) return;
    setCheckoutError(null);
    persistCheckoutContext();
    setIsSubmitting(true);
    try {
      if (isNative()) {
        const pi = await createPaymentIntent(false);
        if (!pi) return;
        await handleNativeWalletConfirm(pi);
        return;
      }


      await handleWebWalletConfirm();
    } catch (e: any) {
      console.error('wallet init error:', e);
      showCheckoutError('wallet-init', e?.message || 'Failed to start payment. Please try again.', { code: (e as any)?.code });
    } finally {
      setIsSubmitting(false);
    }
  };


  /** Master Pay button — dispatches by selected method. */
  const handlePayClick = () => {
    // Guard against double taps while a payment request is already in flight.
    if (isSubmitting) return;
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


  return <div className="native-safe-top min-h-dvh bg-background">
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
                    const bundleText = getBundleBreakdownText(sellerItems.length, sellerSettings.get(sellerId));
                    // Item-discount bundles still pay shipping normally, so keep the shipping line.
                    const hasBundleRow = !!bundleText && sellerSettings.get(sellerId)?.mode !== 'item_discount';
                    
                    return (
                      <div key={sellerId} className="space-y-4">
                        {sellerItems.map((item, idx) => (
                          <div key={item.id} className="flex gap-4">
                            <img src={item.image} alt={item.title} className="h-20 w-20 rounded-xl object-cover bg-muted" />
                            <div className="flex-1 flex flex-col justify-between">
                              <h3 className="font-semibold text-foreground">{item.title}</h3>
                              <div className="text-right">
                                <div className="text-right">
                                  {item.offerPrice !== undefined && item.offerOriginalPrice !== undefined && (
                                    <p className="text-xs text-muted-foreground line-through">
                                      ${item.offerOriginalPrice.toFixed(2)}
                                    </p>
                                  )}
                                  <p className="text-lg font-semibold">${Number(item.price).toFixed(2)}</p>
                                </div>
                                {!hasBundleRow && idx === sellerItems.length - 1 && (
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

              {/* Bundle offer labels (one per qualifying seller) */}
              {(() => {
                const groupedItems = new Map<string, Listing[]>();
                validItems.forEach(item => {
                  const existing = groupedItems.get(item.sellerId) || [];
                  groupedItems.set(item.sellerId, [...existing, item]);
                });
                const rows = Array.from(groupedItems.entries())
                  .map(([sellerId, sellerItems]) => ({
                    sellerId,
                    bundleText: getBundleBreakdownText(sellerItems.length, sellerSettings.get(sellerId)),
                  }))
                  .filter(r => r.bundleText);
                if (rows.length === 0) return null;
                return (
                  <div className="px-4 py-3 border-t border-border space-y-2">
                    {rows.map(({ sellerId, bundleText }) => {
                      const isItemDiscount = sellerSettings.get(sellerId)?.mode === 'item_discount';
                      const shipping = shippingBySeller.get(sellerId) || 0;
                      const discount = discountBySeller.get(sellerId) || 0;
                      return (
                        <div key={sellerId} className="flex items-end justify-between gap-3 text-accent-foreground text-sm">
                          <div className="text-left">
                            <div><span className="mr-1">{bundleText!.emoji}</span><span className="font-bold">{bundleText!.label}</span></div>
                            <div>{bundleText!.detail}</div>
                          </div>
                          <div className="text-right whitespace-nowrap text-muted-foreground">
                            {isItemDiscount ? `- $${discount.toFixed(2)}` : `+$${shipping.toFixed(2)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}


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
                  <button aria-label="Edit delivery address" onClick={() => setIsEditing(true)} className="text-muted-foreground hover:text-foreground transition-colors">
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

            <PaymentMethodPicker
              value={selectedMethod}
              onChange={setSelectedMethod}
              amountCents={Math.round(total * 100)}
            />


            {/* Persistent on-screen error panel. Toasts are hidden behind
                native payment sheets, so failures are always surfaced here. */}
            {checkoutError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <div className="font-medium">{checkoutError.message}</div>
                <div className="mt-1 text-[11px] text-destructive/80">
                  Stage: {checkoutError.stage}
                  {checkoutError.code ? ` · Code: ${checkoutError.code}` : ''}
                  {checkoutError.ref ? ` · Ref: ${checkoutError.ref}` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutError(null)}
                  className="mt-2 text-[11px] underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Items that dropped out of the order, named so the total makes sense. */}
            {unavailableItems.length > 0 && (
              <div
                role="status"
                className="mt-4 rounded-xl border border-muted-foreground/20 bg-muted/50 p-3 text-sm text-muted-foreground"
              >
                <div className="font-medium text-foreground">Some items were removed</div>
                <ul className="mt-1 space-y-0.5">
                  {unavailableItems.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.title}</span> {item.reason}, so it isn't part of this order.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Buyer protection reassurance, restating the 48-hour window. */}
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <ShieldCheck size={15} className="mt-[1px] shrink-0 text-foreground" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">Buyer protection included.</span> Your money is held until
                48 hours after delivery. If something's wrong, raise it in that window and we'll step in.
              </span>
            </div>


            {/* Master Pay button */}

            <div className="mt-6">
              {(() => {
                const offerItem = (validItems as any[]).find((i) => i.offerExpiresAt);
                if (!offerItem) return null;
                return (
                  <p className="mb-3 rounded-xl bg-primary/15 px-3 py-2 text-center text-xs text-foreground">
                    <span className="font-semibold">💰 Offer price locked</span> for{' '}
                    {offerTimeLeft(offerItem.offerExpiresAt).replace(' left', '')} - pay before it expires.
                  </p>
                );
              })()}
              <Button
                onClick={handlePayClick}
                disabled={isSubmitting || !isShippingComplete || !sellerHasStripe || (!isNative() && !selectedMethod) || buyerOwesCents > 0}
                className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light font-medium disabled:opacity-50"
              >
                {buyerOwesCents > 0 ? 'Settle balance to buy' : payButtonLabel()}
              </Button>

              <p className="text-[11px] text-muted-foreground/70 text-center mt-5 flex items-center justify-center gap-1">
                <Lock size={11} /> Payments are encrypted and processed by our payment providers.
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
            billingPostcode={shippingPostcode}
          />
        </DrawerContent>
      </Drawer>
    </div>;
};
export default Checkout;
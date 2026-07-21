import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Listing } from '@/types/listing';
import OrderSuccessDialog from '@/components/OrderSuccessDialog';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { removeFromCart, refetch: refetchCart } = useCart();
  const [showSuccess, setShowSuccess] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [finalizationError, setFinalizationError] = useState<string | null>(null);

  useEffect(() => {
    const processOrder = async () => {
      // Accept either the hosted Checkout Session id (legacy) or the
      // in-app PaymentIntent id (new PaymentSheet / Payment Element flow).
      const sessionId = searchParams.get('session_id');
      const paymentIntentId = searchParams.get('payment_intent');
      const reference = sessionId || paymentIntentId || localStorage.getItem('checkout_reference');
      const isDemo = searchParams.get('demo') === '1';
      const demoOrderGroup = searchParams.get('order_group');

      if (!reference && !isDemo) {
        navigate('/');
        return;
      }

      if (loading) {
        return;
      }

      if (!user) {
        navigate('/');
        return;
      }

      // Demo bypass: orders were already inserted by the edge function.
      // Skip finalize-checkout, just clear local state and show success.
      if (isDemo) {
        try {
          const itemsJson = localStorage.getItem('checkout_items');
          if (itemsJson) {
            const items: Listing[] = JSON.parse(itemsJson);
            items.forEach(item => removeFromCart(item.id));
          }
          await refetchCart();
          await queryClient.invalidateQueries({ queryKey: ['orders'] });
          ['checkout_items','checkout_shipping','checkout_seller_settings','checkout_shipping_by_seller','checkout_payment_method','checkout_reference','checkout_coupon_code']
            .forEach(k => localStorage.removeItem(k));
          if (user?.id) localStorage.removeItem(`flea_draft_checkout_v1_${user.id}`);
        } catch (e) { console.error('Demo cleanup failed:', e); }
        setShowSuccess(true);
        setProcessing(false);
        return;
      }


      try {
        // Retrieve saved checkout data
        const itemsJson = localStorage.getItem('checkout_items');
        const shippingJson = localStorage.getItem('checkout_shipping');
        const shippingBySellerJson = localStorage.getItem('checkout_shipping_by_seller');

        if (!itemsJson || !shippingJson) {
          // Data missing - payment succeeded but we can't create orders client-side
          // Still show success since payment went through
          setShowSuccess(true);
          setProcessing(false);
          return;
        }

        const items: Listing[] = JSON.parse(itemsJson);
        const shipping = JSON.parse(shippingJson);
        const shippingBySeller = new Map<string, number>(JSON.parse(shippingBySellerJson || '[]'));

        const checkoutReference = reference;
        const couponCode = localStorage.getItem('checkout_coupon_code');

        let finalizeData: any = null;
        let finalizeError: any = null;

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const { data, error } = await invokeCloudFunction('finalize-checkout', {
            items: items.map(item => ({ id: item.id, sellerId: item.sellerId, price: item.price })),
            shipping,
            shippingBySeller: Array.from(shippingBySeller.entries()),
            paymentMethod: 'stripe',
            checkoutReference,
            couponCode,
          });

          finalizeData = data;
          finalizeError = error;

          if (!error && data?.ok) {
            break;
          }

          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        if (finalizeError) throw finalizeError;

        if (!finalizeData?.ok) {
          throw new Error('Checkout finalization failed');
        }

        // Remove items from cart
        items.forEach(item => removeFromCart(item.id));
        await refetchCart();
        await queryClient.invalidateQueries({ queryKey: ['orders'] });

        // Clean up sessionStorage
        localStorage.removeItem('checkout_items');
        localStorage.removeItem('checkout_shipping');
        localStorage.removeItem('checkout_seller_settings');
        localStorage.removeItem('checkout_shipping_by_seller');
        localStorage.removeItem('checkout_payment_method');
        localStorage.removeItem('checkout_reference');
        localStorage.removeItem('checkout_coupon_code');

        setShowSuccess(true);
      } catch (error) {
        console.error('Error processing order:', error);
        setFinalizationError('We are still syncing your order. Please retry this page in a moment.');
      } finally {
        setProcessing(false);
      }
    };

    processOrder();
  }, [user, loading, searchParams, navigate, removeFromCart, refetchCart, queryClient]);

  useEffect(() => {
    if (!showSuccess) return;

    const timeoutId = window.setTimeout(() => {
      navigate('/cart', { state: { initialTab: 'orders' } });
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [showSuccess, navigate]);

  if (processing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-2 border-foreground border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Processing your order...</p>
        </div>
      </div>
    );
  }

  if (finalizationError && !showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-foreground font-medium">{finalizationError}</p>
          <div className="flex items-center justify-center gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/cart')}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OrderSuccessDialog
      open={showSuccess}
      onClose={() => navigate('/cart', { state: { initialTab: 'orders' } })}
    />
  );
};

export default CheckoutSuccess;

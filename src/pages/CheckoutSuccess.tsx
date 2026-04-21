import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types/listing';
import OrderSuccessDialog from '@/components/OrderSuccessDialog';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const { removeFromCart } = useCart();
  const [showSuccess, setShowSuccess] = useState(false);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processOrder = async () => {
      const sessionId = searchParams.get('session_id');
      const isPayPal = searchParams.get('paypal') === 'true';
      
      if (!sessionId && !isPayPal) {
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

        const checkoutReference = sessionId || localStorage.getItem('checkout_reference');

        const { data, error } = await invokeCloudFunction('finalize-checkout', {
          items: items.map(item => ({ id: item.id, sellerId: item.sellerId, price: item.price })),
          shipping,
          shippingBySeller: Array.from(shippingBySeller.entries()),
          paymentMethod: localStorage.getItem('checkout_payment_method') || (isPayPal ? 'paypal' : 'stripe'),
          checkoutReference,
        });

        if (error) throw error;

        if (!data?.ok) {
          throw new Error('Checkout finalization failed');
        }

        // Fire push notifications for item sold (seller + cart/wishlist users)
        // Notify cart/wishlist users about sold items
        for (const item of items) {
          // Get users who had this item in cart (excluding buyer and seller)
          const { data: cartUsers } = await supabase
            .from('cart_items')
            .select('user_id')
            .eq('listing_id', item.id)
            .neq('user_id', user.id)
            .neq('user_id', item.sellerId);

          const { data: wishlistUsers } = await supabase
            .from('favorites')
            .select('user_id')
            .eq('listing_id', item.id)
            .neq('user_id', user.id)
            .neq('user_id', item.sellerId);

          const cartUserIds = new Set((cartUsers || []).map(u => u.user_id));
          const wishlistUserIds = new Set((wishlistUsers || []).map(u => u.user_id));

          for (const uid of cartUserIds) {
            const type = wishlistUserIds.has(uid) ? 'cart_wishlist_item_sold' : 'cart_item_sold';
            sendPushNotification(uid, {
              type,
              title: 'Item Sold',
              message: item.title,
              related_listing_id: item.id,
            });
          }
          for (const uid of wishlistUserIds) {
            if (!cartUserIds.has(uid)) {
              sendPushNotification(uid, {
                type: 'wishlist_item_sold',
                title: 'Item Sold',
                message: item.title,
                related_listing_id: item.id,
              });
            }
          }
        }

        // Remove items from cart
        items.forEach(item => removeFromCart(item.id));

        // Clean up sessionStorage
        localStorage.removeItem('checkout_items');
        localStorage.removeItem('checkout_shipping');
        localStorage.removeItem('checkout_seller_settings');
        localStorage.removeItem('checkout_shipping_by_seller');
        localStorage.removeItem('checkout_payment_method');
        localStorage.removeItem('checkout_reference');

        setShowSuccess(true);
      } catch (error) {
        console.error('Error processing order:', error);
        // Payment succeeded even if order creation fails
        setShowSuccess(true);
      } finally {
        setProcessing(false);
      }
    };

    processOrder();
  }, [user, loading, searchParams, navigate, removeFromCart]);

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

  return (
    <OrderSuccessDialog
      open={showSuccess}
      onClose={() => navigate('/')}
    />
  );
};

export default CheckoutSuccess;

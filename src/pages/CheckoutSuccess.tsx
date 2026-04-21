import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types/listing';
import { SellerShippingInfo } from '@/utils/shippingCalculator';
import OrderSuccessDialog from '@/components/OrderSuccessDialog';
import { sendPushNotification } from '@/utils/pushNotify';

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
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

        const orderGroupId = crypto.randomUUID();

        // Group items by seller
        const itemsBySeller = new Map<string, Listing[]>();
        items.forEach(item => {
          const existing = itemsBySeller.get(item.sellerId) || [];
          itemsBySeller.set(item.sellerId, [...existing, item]);
        });

        // Create order records
        const orderPromises: Promise<void>[] = [];

        itemsBySeller.forEach((sellerItems, sellerId) => {
          const sellerShipping = shippingBySeller.get(sellerId) || 0;

          sellerItems.forEach((item, index) => {
            const itemShipping = index === 0 ? sellerShipping : 0;

            orderPromises.push((async () => {
              const { error } = await supabase.from('orders').insert({
                order_group_id: orderGroupId,
                listing_id: item.id,
                buyer_id: user.id,
                seller_id: item.sellerId,
                price: item.price,
                shipping_price: itemShipping,
                status: 'awaiting',
                payment_method: localStorage.getItem('checkout_payment_method') || 'stripe',
                shipping_first_name: shipping.shippingFirstName,
                shipping_last_name: shipping.shippingLastName,
                shipping_address: shipping.shippingAddress,
                shipping_city: shipping.shippingCity,
                shipping_state: shipping.shippingState,
                shipping_postcode: shipping.shippingPostcode,
              });

              if (error) throw error;

              await supabase.from('listings').update({ status: 'sold' }).eq('id', item.id);
            })());
          });
        });

        await Promise.all(orderPromises);

        // Fire push notifications for item sold (seller + cart/wishlist users)
        // The DB trigger inserts notifications, but push must be triggered explicitly
        const uniqueSellers = [...new Set(items.map(i => i.sellerId))];
        for (const sellerId of uniqueSellers) {
          const sellerItems = items.filter(i => i.sellerId === sellerId);
          sendPushNotification(sellerId, {
            type: 'item_sold',
            title: 'Item Sold',
            message: `🎉🤑 Cha-ching! Your item "${sellerItems[0].title}" has just sold!`,
            related_listing_id: sellerItems[0].id,
          });
        }

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
  }, [user, searchParams, navigate, removeFromCart]);

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

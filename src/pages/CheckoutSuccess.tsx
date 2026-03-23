import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { Listing } from '@/types/listing';
import { SellerShippingInfo } from '@/utils/shippingCalculator';
import OrderSuccessDialog from '@/components/OrderSuccessDialog';

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
      if (!sessionId || !user) {
        navigate('/');
        return;
      }

      try {
        // Retrieve saved checkout data
        const itemsJson = sessionStorage.getItem('checkout_items');
        const shippingJson = sessionStorage.getItem('checkout_shipping');
        const shippingBySellerJson = sessionStorage.getItem('checkout_shipping_by_seller');

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
                payment_method: sessionStorage.getItem('checkout_payment_method') || 'stripe',
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

        // Remove items from cart
        items.forEach(item => removeFromCart(item.id));

        // Clean up sessionStorage
        sessionStorage.removeItem('checkout_items');
        sessionStorage.removeItem('checkout_shipping');
        sessionStorage.removeItem('checkout_seller_settings');
        sessionStorage.removeItem('checkout_shipping_by_seller');
        sessionStorage.removeItem('checkout_payment_method');

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

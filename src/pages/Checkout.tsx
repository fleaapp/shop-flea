import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Listing } from '@/types/listing';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { removeFromCart } = useCart();
  
  const items: Listing[] = location.state?.items || [];
  
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">No items to checkout</p>
        <Button onClick={() => navigate('/cart')} className="mt-4">
          Back to Cart
        </Button>
      </div>
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const shipping = items.reduce((sum, item) => sum + item.shippingPrice, 0);
  const total = subtotal + shipping;

  const handlePlaceOrder = () => {
    // Remove items from cart
    items.forEach((item) => removeFromCart(item.id));
    
    toast.success('Order placed successfully!', {
      description: `Your order of $${total.toFixed(2)} is being processed`,
    });
    
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-4 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Checkout</h1>
      </header>

      <div className="p-4 space-y-6">
        {/* Order Items */}
        <div className="space-y-3">
          <h2 className="font-semibold text-foreground">Order Summary</h2>
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-xl bg-card p-3 card-shadow">
              <img
                src={item.image}
                alt={item.title}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h3 className="font-medium text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">from {item.sellerName}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">${item.price}</p>
                <p className="text-xs text-muted-foreground">+ ${item.shippingPrice}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Shipping Info */}
        <div className="rounded-xl bg-card p-4 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Shipping Address</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Add your shipping address to complete the order
          </p>
          <Button variant="outline" className="mt-3 w-full rounded-xl">
            Add Address
          </Button>
        </div>

        {/* Payment Method */}
        <div className="rounded-xl bg-card p-4 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Payment Method</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Add a payment method to complete the order
          </p>
          <Button variant="outline" className="mt-3 w-full rounded-xl">
            Add Payment
          </Button>
        </div>

        {/* Order Total */}
        <div className="rounded-xl bg-card p-4 card-shadow space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span className="text-foreground">${shipping.toFixed(2)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Place Order Button */}
        <Button
          onClick={handlePlaceOrder}
          className="w-full h-14 rounded-2xl bg-charcoal text-white hover:bg-charcoal-light text-base font-medium"
        >
          Place Order - ${total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
};

export default Checkout;

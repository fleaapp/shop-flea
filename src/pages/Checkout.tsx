import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Listing } from '@/types/listing';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import OrderSuccessDialog from '@/components/OrderSuccessDialog';
type PaymentMethod = 'card' | 'paypal' | 'applepay';
const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    removeFromCart
  } = useCart();
  const items: Listing[] = location.state?.items || [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(true);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('card');
  const [selectedCard, setSelectedCard] = useState<string | null>('saved-1');
  const [showNewCard, setShowNewCard] = useState(false);
  const [saveCard, setSaveCard] = useState(true);
  

  // Form state
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cvv, setCvv] = useState('');
  const [expiry, setExpiry] = useState('');

  // Shipping details state
  const [shippingFirstName, setShippingFirstName] = useState('');
  const [shippingLastName, setShippingLastName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostcode, setShippingPostcode] = useState('');
  const handleClose = () => {
    setOpen(false);
    setTimeout(() => navigate(-1), 300);
  };
  if (items.length === 0) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">No items to checkout</p>
        <Button onClick={() => navigate('/cart')} className="mt-4">
          Back to Cart
        </Button>
      </div>;
  }
  const subtotal = items.reduce((sum, item) => sum + item.price + item.shippingPrice, 0);
  const sellerFee = subtotal * 0.04;
  const total = subtotal + sellerFee;
  
  const isShippingComplete = shippingFirstName.trim() && shippingLastName.trim() && shippingAddress.trim() && shippingCity.trim() && shippingState.trim() && shippingPostcode.trim();
  
  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error('You must be logged in to place an order');
      return;
    }
    
    if (!isShippingComplete) {
      toast.error('Please fill in all shipping details');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create order records for each item
      const orderPromises = items.map(async (item) => {
        const { error } = await supabase.from('orders').insert({
          listing_id: item.id,
          buyer_id: user.id,
          seller_id: item.sellerId,
          price: item.price,
          shipping_price: item.shippingPrice,
          status: 'awaiting',
        });
        
        if (error) throw error;
        
        // Update listing status to sold
        await supabase.from('listings').update({ status: 'sold' }).eq('id', item.id);
      });
      
      await Promise.all(orderPromises);
      
      // Remove items from cart
      items.forEach(item => removeFromCart(item.id));
      
      // Show success dialog over the checkout drawer (don't close it)
      setShowOrderSuccess(true);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
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
              
              {/* Items */}
              <div className="p-4 space-y-4">
                {items.map(item => <div key={item.id} className="flex gap-4">
                    <img src={item.image} alt={item.title} className="h-20 w-20 rounded-xl object-cover" />
                    <div className="flex-1 flex flex-col">
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <div className="flex-1" />
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">${item.price}</p>
                        <p className="text-sm text-muted-foreground">+ ${item.shippingPrice} shipping</p>
                      </div>
                    </div>
                  </div>)}
              </div>
              
              {/* Seller fee */}
              <div className="px-4 py-3 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground">4% seller fee</span>
                <span className="text-foreground">− ${sellerFee.toFixed(2)}</span>
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

            {/* Payment Method */}
            <div className="mt-6">
              <h2 className="font-semibold text-foreground mb-3">Payment method</h2>
              <div className="flex gap-3">
                <button onClick={() => setSelectedPayment('card')} className={cn('flex items-center justify-center h-14 w-16 rounded-xl border-2 transition-all', selectedPayment === 'card' ? 'border-charcoal bg-card' : 'border-border bg-card')}>
                  <div className="flex">
                    <div className="h-6 w-6 rounded-full bg-red-500 -mr-2" />
                    <div className="h-6 w-6 rounded-full bg-orange-400" />
                  </div>
                </button>
                
                <button onClick={() => setSelectedPayment('paypal')} className={cn('flex items-center justify-center h-14 w-16 rounded-xl border-2 transition-all', selectedPayment === 'paypal' ? 'border-charcoal bg-card' : 'border-border bg-card')}>
                  <span className="text-sm font-bold text-blue-600">PayPal</span>
                </button>
                
                <button onClick={() => setSelectedPayment('applepay')} className={cn('flex items-center justify-center h-14 w-16 rounded-xl border-2 transition-all', selectedPayment === 'applepay' ? 'border-charcoal bg-card' : 'border-border bg-card')}>
                  <span className="text-sm font-semibold text-foreground"> Pay</span>
                </button>
              </div>
            </div>

            {/* Saved Cards */}
            {selectedPayment === 'card' && !showNewCard && <div className="mt-6">
                <h2 className="font-semibold text-foreground mb-3">Saved cards</h2>
                <div className="space-y-3">
                  {savedCards.map(card => <button key={card.id} onClick={() => setSelectedCard(card.id)} className={cn('w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all', selectedCard === card.id ? 'border-charcoal bg-card' : 'border-border bg-card')}>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-red-500 -mr-2" />
                        <div className="h-6 w-6 rounded-full bg-orange-400" />
                      </div>
                      <span className="flex-1 text-left text-foreground">Ending in {card.lastFour}.</span>
                      <div className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center', selectedCard === card.id ? 'border-charcoal bg-charcoal' : 'border-muted-foreground/30')}>
                        {selectedCard === card.id && <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                    </button>)}
                </div>
                
                <button onClick={() => {
              setShowNewCard(true);
              setSelectedCard(null);
            }} className="mt-4 w-full text-center text-sm font-medium text-foreground hover:text-muted-foreground">
                  + Add new card
                </button>
              </div>}

            {/* New Card Form */}
            {selectedPayment === 'card' && showNewCard && <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Card holder name</label>
                  <Input value={cardHolder} onChange={e => setCardHolder(e.target.value)} className="h-12 rounded-xl bg-card border-border focus-visible:ring-muted-foreground/50" placeholder="Name on card" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Card number</label>
                  <Input value={cardNumber} onChange={e => setCardNumber(e.target.value)} className="h-12 rounded-xl bg-card border-border focus-visible:ring-muted-foreground/50" placeholder="1234 5678 9012 3456" maxLength={19} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">CVV</label>
                    <Input value={cvv} onChange={e => setCvv(e.target.value)} className="h-12 rounded-xl bg-card border-border focus-visible:ring-muted-foreground/50" placeholder="123" maxLength={4} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Expiry</label>
                    <Input value={expiry} onChange={e => setExpiry(e.target.value)} className="h-12 rounded-xl bg-card border-border focus-visible:ring-muted-foreground/50" placeholder="MM/YY" maxLength={5} />
                  </div>
                </div>
                
                <div className="flex items-center gap-3 pt-2">
                  <Checkbox id="save-card" checked={saveCard} onCheckedChange={checked => setSaveCard(checked as boolean)} />
                  <label htmlFor="save-card" className="text-sm text-muted-foreground">
                    Save card information.
                  </label>
                </div>
              </div>}

            {/* Confirm Button */}
            <div className="mt-8">
              <Button 
                onClick={handlePlaceOrder} 
                disabled={isSubmitting || !isShippingComplete}
                className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Placing order...' : 'Confirm order'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* Order Success Dialog */}
      <OrderSuccessDialog 
        open={showOrderSuccess} 
        onClose={() => {
          setShowOrderSuccess(false);
          setOpen(false);
          setTimeout(() => navigate('/'), 300);
        }} 
      />
    </div>;
};
export default Checkout;
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, OrderStatus } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { useExistingReview } from '@/hooks/useReviews';
import WriteReviewDrawer from '@/components/WriteReviewDrawer';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import OrderReceiptDialog from '@/components/OrderReceiptDialog';
import { useAuth } from '@/context/AuthContext';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import ShippingStatusTracker from '@/components/ShippingStatusTracker';
import { openTrackingUrl } from '@/lib/tracking';

interface SalesDetailsSheetProps {
  orders: Order[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkShipped?: (trackingDetails: { serviceProvider: string; trackingNumber: string }) => void;
}

const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case 'awaiting':
      return { label: 'Awaiting shipping', variant: 'success' as const };
    case 'shipped':
      return { label: 'Shipped', variant: 'secondary' as const };
    case 'delivered':
      return { label: 'Delivered', variant: 'secondary' as const };
  }
};

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
    {children}
  </div>
);

const SalesDetailsSheet = ({
  orders,
  open,
  onOpenChange,
  onMarkShipped,
}: SalesDetailsSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [serviceProvider, setServiceProvider] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [validationError, setValidationError] = useState('');
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const { getGroupUnread } = useUnreadOrderMessages();
  
  const primaryOrder = orders?.[0];
  const { data: existingReview } = useExistingReview(primaryOrder?.id);

  // Reset form when order changes
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const providers = Array.from(
      new Set(orders.map((o) => o.tracking_provider).filter(Boolean) as string[])
    );
    const numbers = Array.from(
      new Set(orders.map((o) => o.tracking_number).filter(Boolean) as string[])
    );

    setServiceProvider(providers.length === 1 ? providers[0] : '');
    setTrackingNumber(numbers.length === 1 ? numbers[0] : '');
    setValidationError('');
  }, [orders]);

  if (!orders || orders.length === 0) return null;

  const subtotal = orders.reduce((sum, o) => sum + o.price + o.shipping_price, 0);
  const platformFee = subtotal * 0.07;
  const youReceived = subtotal - platformFee;
  const statusBadge = getStatusBadge(primaryOrder.status);
  const formattedDate = format(new Date(primaryOrder.created_at), 'dd/MM/yyyy');

  const handleMarkShipped = () => {
    // Validate tracking details
    if (!serviceProvider.trim()) {
      setValidationError('Please enter a service provider');
      return;
    }
    if (!trackingNumber.trim()) {
      setValidationError('Please enter a tracking number');
      return;
    }
    setValidationError('');
    onMarkShipped?.({ serviceProvider: serviceProvider.trim(), trackingNumber: trackingNumber.trim() });
  };

  const rawBuyerUsername = primaryOrder.buyer_profile?.username || 'Unknown';
  const buyerUsername = rawBuyerUsername.startsWith('@') ? rawBuyerUsername.slice(1) : rawBuyerUsername;
  const buyerAvatar = primaryOrder.buyer_profile?.avatar_url || getDefaultAvatar(primaryOrder.buyer_id);

  const providers = Array.from(new Set(orders.map((o) => o.tracking_provider).filter(Boolean) as string[]));
  const numbers = Array.from(new Set(orders.map((o) => o.tracking_number).filter(Boolean) as string[]));
  const trackingProviderDisplay =
    primaryOrder.status === 'awaiting' ? 'Awaiting shipping' : (providers.length === 1 ? providers[0] : 'Multiple');
  const trackingNumberDisplay =
    primaryOrder.status === 'awaiting' ? 'Awaiting shipping' : (numbers.length === 1 ? numbers[0] : 'Multiple');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">Sale details</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Order #{primaryOrder.order_number || (primaryOrder.order_group_id || primaryOrder.id).slice(0, 8).toUpperCase()} • {formattedDate}
            </p>
            <div className="flex justify-center mt-1 mb-2">
              <Badge variant={statusBadge.variant}>
                {statusBadge.label}
              </Badge>
            </div>
            {/* Receipt & Message buttons */}
            <div className="flex justify-center gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => setReceiptOpen(true)}
                className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-primary active:border-primary"
              >
                🧾
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => navigate(`/order-chat/${primaryOrder.order_group_id || primaryOrder.id}`), 300);
                }}
                className="relative h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-primary active:border-primary"
              >
                💬
                {orders.reduce((sum, order) => sum + getGroupUnread(order.id), 0) > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {orders.reduce((sum, order) => sum + getGroupUnread(order.id), 0)}
                  </span>
                ) : null}
              </Button>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-8 space-y-4">
            {/* Buyer Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Buyer</SectionHeader>
              <div
                className="flex items-center gap-3 p-4 cursor-pointer active:bg-muted/50 transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => navigate(user?.id === primaryOrder.buyer_id ? '/profile' : `/seller/${primaryOrder.buyer_id}`), 300);
                }}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={buyerAvatar} alt={buyerUsername} />
                  <AvatarFallback>{buyerUsername.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-bold underline">@{buyerUsername}</span>
              </div>
            </div>

            {/* Shipping Address Section - Where to ship */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Ship To</SectionHeader>
              <div className="p-4 space-y-0.5">
                <p className="font-medium text-foreground">
                  {primaryOrder.shipping_first_name} {primaryOrder.shipping_last_name}
                </p>
                <p className="text-muted-foreground">
                  {[primaryOrder.shipping_address, primaryOrder.shipping_city].filter(Boolean).join(', ')}
                </p>
                <p className="text-muted-foreground">
                  {[primaryOrder.shipping_state, primaryOrder.shipping_postcode].filter(Boolean).join(' ')}
                </p>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Order Summary</SectionHeader>
              <div>
                <div className="px-4 py-4 space-y-4">
                  {orders.map((o) => {
                    const listingTitle = o.listing?.title || 'Item';
                    const listingImage = o.listing?.images?.[0] || '';

                    return (
                      <div key={o.id} className="flex gap-4">
                        <img
                          src={listingImage}
                          alt={listingTitle}
                          className="h-20 w-20 rounded-xl object-cover bg-muted"
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <h3 className="font-semibold text-foreground">{listingTitle}</h3>
                          <div className="text-right">
                            <p className="text-lg font-semibold">${o.price}</p>
                            <p className="text-sm text-muted-foreground">+${o.shipping_price} shipping</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fee line */}
                <div className="flex justify-between text-sm px-4 py-3 border-t border-border">
                  <span className="text-muted-foreground">Platform fee (7%)</span>
                  <span className="text-muted-foreground">- ${platformFee.toFixed(2)}</span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                  <span className="font-medium">You received: ${youReceived.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Tracking Details Section - Editable for awaiting status */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Tracking Details</SectionHeader>
              <div className="p-4 space-y-3">
                {primaryOrder.status === 'awaiting' ? (
                  <>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Service Provider:</p>
                      <Input
                        value={serviceProvider}
                        onChange={(e) => setServiceProvider(e.target.value)}
                        placeholder="e.g. Royal Mail, DPD, Evri"
                        className="bg-background"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Tracking number:</p>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Enter tracking number"
                        className="bg-background"
                      />
                    </div>
                    {validationError && (
                      <p className="text-sm text-destructive">{validationError}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Service Provider:</p>
                      <Input
                        value={trackingProviderDisplay || 'N/A'}
                        disabled
                        className="bg-background disabled:opacity-70"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Tracking number:</p>
                      <Input
                        value={trackingNumberDisplay || 'N/A'}
                        disabled
                        className="bg-background disabled:opacity-70"
                      />
                    </div>
                    {trackingNumberDisplay && trackingNumberDisplay !== 'Multiple' && (
                      <Button
                        type="button"
                        onClick={() =>
                          openTrackingUrl(
                            trackingProviderDisplay === 'Multiple' ? null : trackingProviderDisplay,
                            trackingNumberDisplay,
                          )
                        }
                        className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-10"
                      >
                        📦 Track parcel
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Shipping Status Tracker - visible once shipped */}
            {(primaryOrder.status === 'shipped' || primaryOrder.status === 'delivered') && (
              <ShippingStatusTracker
                createdAt={primaryOrder.created_at}
                shippedAt={primaryOrder.shipped_at}
                deliveredAt={primaryOrder.delivered_at}
                status={primaryOrder.status}
              />
            )}
            {primaryOrder.status === 'awaiting' && (
              <div className="flex justify-center">
                <Button
                  onClick={handleMarkShipped}
                  className="rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 px-8"
                >
                  Mark as shipped
                </Button>
              </div>
            )}

            {/* Payment & Payout Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Payment & Payout</SectionHeader>
              <div className="p-4 space-y-4">
              <div className="flex justify-center">
                  <button
                    className="text-sm text-foreground underline"
                    onClick={() => {
                      window.open('https://dashboard.stripe.com/payments', '_blank');
                    }}
                  >
                    View order on Stripe →
                  </button>
                </div>
                <div className="border-t border-border -mx-4" />
                <div className="flex flex-col items-center space-y-3 py-2">
                  <p className="text-sm text-center">
                    <span className="font-semibold text-foreground">Need your funds faster?</span>
                    <br />
                    <span className="text-muted-foreground">Request an instant payout for a 1.5% fee.</span>
                  </p>
                  <Button
                    className="rounded-full h-10 px-6 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      window.open('https://dashboard.stripe.com/payouts', '_blank');
                    }}
                  >
                    Instant payout (1.5% fee)
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center space-y-3 pt-4">
              <div className="flex items-center gap-3 w-full px-4">
                <Button
                  onClick={() => {
                    window.open('https://dashboard.stripe.com/payments', '_blank');
                  }}
                  variant="outline"
                  className="flex-1 rounded-full h-12 bg-muted-foreground/60 text-white hover:bg-muted-foreground/70 border-none"
                >
                  Refund sale
                </Button>
                {primaryOrder.status === 'delivered' && !existingReview && (
                  <Button
                    onClick={() => setReviewDrawerOpen(true)}
                    className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                  >
                    Review Buyer
                  </Button>
                )}
              </div>
              <button
                className="text-center text-sm text-foreground underline"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => navigate('/contact-support'), 300);
                }}
              >
                Need help?
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>

      <WriteReviewDrawer
        orderId={primaryOrder.id}
        reviewedUserId={primaryOrder.buyer_id}
        reviewedUsername={buyerUsername}
        reviewType="buyer"
        open={reviewDrawerOpen}
        onOpenChange={setReviewDrawerOpen}
      />

      <OrderReceiptDialog
        orders={orders}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        viewAs="seller"
      />
    </Drawer>
  );
};

export default SalesDetailsSheet;

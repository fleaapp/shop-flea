import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Order, OrderStatus } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { useExistingReview } from '@/hooks/useReviews';
import WriteReviewDrawer from '@/components/WriteReviewDrawer';
import { getDefaultAvatar } from '@/utils/defaultAvatars';

interface OrderDetailsSheetProps {
  orders: Order[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkDelivered?: () => void;
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

const OrderDetailsSheet = ({
  orders,
  open,
  onOpenChange,
  onMarkDelivered,
}: OrderDetailsSheetProps) => {
  const navigate = useNavigate();
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  
  const primaryOrder = orders?.[0];
  const { data: existingReview } = useExistingReview(primaryOrder?.id);
  
  if (!orders || orders.length === 0) return null;

  const subtotal = orders.reduce((sum, o) => sum + o.price + o.shipping_price, 0);
  const processingFee = subtotal * 0.02;
  const total = subtotal + processingFee;
  // Note: buyer pays 2% processing fee; seller pays 7% platform fee (shown in SalesDetailsSheet)
  const statusBadge = getStatusBadge(primaryOrder.status);
  const formattedDate = format(new Date(primaryOrder.created_at), 'dd/MM/yyyy');

  const rawUsername = primaryOrder.seller_profile?.username || 'Unknown';
  const sellerUsername = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername;
  const sellerAvatar = primaryOrder.seller_profile?.avatar_url || getDefaultAvatar(primaryOrder.seller_id);

  const displayId = primaryOrder.order_number || (primaryOrder.order_group_id || primaryOrder.id).slice(0, 8).toUpperCase();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">Order details</DrawerTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Order #{displayId} • {formattedDate}
              </p>
            <div className="flex justify-center mt-1 mb-2">
              <Badge variant={statusBadge.variant}>
                {statusBadge.label}
              </Badge>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-8 space-y-4">
            {/* Seller Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Seller</SectionHeader>
              <div
                className="flex items-center gap-3 p-4 cursor-pointer active:bg-muted/50 transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => navigate(`/seller/${primaryOrder.seller_id}`), 300);
                }}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={sellerAvatar} alt={sellerUsername} />
                  <AvatarFallback>{sellerUsername.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-bold underline">@{sellerUsername}</span>
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
                            <p className="text-sm text-muted-foreground">+ ${o.shipping_price} shipping</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fee line */}
                <div className="flex justify-between text-sm px-4 py-3 border-t border-border">
                  <span className="text-muted-foreground">Payment processing fee (2%)</span>
                  <span className="text-muted-foreground">+ ${processingFee.toFixed(2)}</span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                  <span className="font-medium">Total amount paid: ${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Shipping Address</SectionHeader>
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

            {/* Tracking Details Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Tracking Details</SectionHeader>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Service Provider:</p>
                  <p className="text-muted-foreground">
                    {primaryOrder.status === 'awaiting'
                      ? 'Awaiting shipping'
                      : (primaryOrder.tracking_provider || 'N/A')}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Tracking number:</p>
                  <p className="text-muted-foreground">
                    {primaryOrder.status === 'awaiting'
                      ? 'Awaiting shipping'
                      : (primaryOrder.tracking_number || 'N/A')}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center space-y-3 pt-4">
              {primaryOrder.status === 'shipped' && (
                <Button
                  onClick={onMarkDelivered}
                  className="rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 px-8"
                >
                  Mark as delivered
                </Button>
              )}
              {primaryOrder.status === 'delivered' && !existingReview && (
                <Button
                  onClick={() => setReviewDrawerOpen(true)}
                  className="rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 px-8"
                >
                  Review Seller
                </Button>
              )}
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
        reviewedUserId={primaryOrder.seller_id}
        reviewedUsername={sellerUsername}
        reviewType="seller"
        open={reviewDrawerOpen}
        onOpenChange={setReviewDrawerOpen}
      />
    </Drawer>
  );
};

export default OrderDetailsSheet;

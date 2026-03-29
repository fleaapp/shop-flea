import { useState, useMemo } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Order, OrderStatus } from '@/hooks/useOrders';
import { format, differenceInDays } from 'date-fns';
import { useExistingReview } from '@/hooks/useReviews';
import WriteReviewDrawer from '@/components/WriteReviewDrawer';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import OrderReceiptDialog from '@/components/OrderReceiptDialog';
import RefundRequestDialog from '@/components/RefundRequestDialog';
import { useAuth } from '@/context/AuthContext';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import ShippingStatusTracker from '@/components/ShippingStatusTracker';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const { user } = useAuth();
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [deliveredConfirmOpen, setDeliveredConfirmOpen] = useState(false);
  const { getGroupUnread } = useUnreadOrderMessages();
  const queryClient = useQueryClient();
  
  const primaryOrder = orders?.[0];
  const { data: existingReview } = useExistingReview(primaryOrder?.id);

  const isBuyer = !!user?.id && user.id === primaryOrder?.buyer_id;
  const refundWindowExpired = useMemo(() => {
    if (!primaryOrder?.delivered_at) return false;
    return differenceInDays(new Date(), new Date(primaryOrder.delivered_at)) > 10;
  }, [primaryOrder?.delivered_at]);
  const canShowRefundButton = isBuyer && !refundWindowExpired;

  // Check if there's a pending refund request (no seller response yet)
  const { data: refundStatus } = useQuery({
    queryKey: ['refund-status', primaryOrder?.id],
    queryFn: async () => {
      if (!primaryOrder?.id || !isBuyer) return { hasPending: false };
      const { data } = await invokeCloudFunction('order-messages', {
        method: 'GET',
        query: { orderId: primaryOrder.id },
      });
      const messages = ((data as { messages?: Array<{ message_type: string }> })?.messages) || [];
      const hasRequest = messages.some((m: { message_type: string }) => m.message_type === 'refund_request');
      let pendingCount = 0;
      for (const m of messages) {
        if (m.message_type === 'refund_request') pendingCount++;
        if (m.message_type === 'refund_rejected' || m.message_type === 'refund_initiated') {
          pendingCount = Math.max(0, pendingCount - 1);
        }
      }
      return { hasPending: pendingCount > 0, hasAnyRequest: hasRequest };
    },
    enabled: !!primaryOrder?.id && isBuyer,
  });

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

  const chatThreadId = primaryOrder.order_group_id || primaryOrder.id;
  const displayId = primaryOrder.order_number || chatThreadId.slice(0, 8).toUpperCase();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
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
                    setTimeout(() => navigate(`/order-chat/${chatThreadId}`), 300);
                  }}
                  className="relative h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-primary active:border-primary"
                >
                  💬
                  {(() => {
                    const unread = orders.reduce((sum, order) => sum + getGroupUnread(order.id), 0);
                  return unread > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {unread}
                    </span>
                  ) : null;
                })()}
              </Button>
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
                  setTimeout(() => navigate(user?.id === primaryOrder.seller_id ? '/profile' : `/seller/${primaryOrder.seller_id}`), 300);
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
                            <p className="text-sm text-muted-foreground">+${o.shipping_price} shipping</p>
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
                  <p className="font-semibold text-foreground mb-1.5">Service Provider:</p>
                  <Input
                    value={primaryOrder.status === 'awaiting' ? 'Awaiting shipping' : (primaryOrder.tracking_provider || 'N/A')}
                    disabled
                    className="bg-background disabled:opacity-70"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1.5">Tracking number:</p>
                  <Input
                    value={primaryOrder.status === 'awaiting' ? 'Awaiting shipping' : (primaryOrder.tracking_number || 'N/A')}
                    disabled
                    className="bg-background disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Status Tracker */}
            <ShippingStatusTracker
              createdAt={primaryOrder.created_at}
              shippedAt={primaryOrder.shipped_at}
              deliveredAt={primaryOrder.delivered_at}
              status={primaryOrder.status}
            />
            <div className="flex flex-col items-center space-y-3 pt-4">
              <div className="flex items-center gap-3 w-full px-4">
                {(primaryOrder.status === 'awaiting' || primaryOrder.status === 'shipped') && (
                  <Button
                    onClick={() => {
                      if (primaryOrder.status === 'awaiting') {
                        setDeliveredConfirmOpen(true);
                      } else {
                        onMarkDelivered?.();
                      }
                    }}
                    className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                  >
                    Mark as delivered
                  </Button>
                )}
                {primaryOrder.status === 'delivered' && !existingReview && (
                  <Button
                    onClick={() => setReviewDrawerOpen(true)}
                    className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                  >
                    Review Seller
                  </Button>
                )}
                {canShowRefundButton && (
                  <Button
                    onClick={() => {
                      if (refundStatus?.hasPending || refundStatus?.hasAnyRequest) {
                        onOpenChange(false);
                        setTimeout(() => navigate(`/order-chat/${chatThreadId}`), 300);
                      } else {
                        setRefundDialogOpen(true);
                      }
                    }}
                    disabled={refundWindowExpired}
                    variant="outline"
                    className="flex-1 rounded-full h-12 bg-muted-foreground/60 text-white hover:bg-muted-foreground/70 border-none disabled:opacity-60"
                  >
                    {refundStatus?.hasPending || refundStatus?.hasAnyRequest ? 'Refund Requested' : refundWindowExpired ? 'Refund Window Closed' : 'Request Refund'}
                  </Button>
                )}
              </div>
              <button
                className="text-center text-sm text-foreground underline mt-2"
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

      <OrderReceiptDialog
        orders={orders}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        viewAs="buyer"
      />

      {user?.id && primaryOrder && (
        <RefundRequestDialog
          open={refundDialogOpen}
          onOpenChange={setRefundDialogOpen}
          orderId={primaryOrder.id}
          userId={user.id}
          onSubmit={async ({ reason, details, imageUploads }) => {
            const { data, error } = await invokeCloudFunction('order-messages', {
              method: 'POST',
              query: { orderId: primaryOrder.id, action: 'refund_request' },
              body: { reason, details, image_uploads: imageUploads },
            });
            if (error) {
              console.error('[RefundRequest] Error:', error);
              throw new Error(typeof error === 'object' && error.message ? error.message : 'Failed to submit refund request');
            }
            // Also check if the response body contains an error
            if (data && typeof data === 'object' && 'error' in data) {
              console.error('[RefundRequest] Server error:', (data as { error: string }).error);
              throw new Error((data as { error: string }).error);
            }
            queryClient.invalidateQueries({ queryKey: ['refund-status', primaryOrder.id] });
            queryClient.invalidateQueries({ queryKey: ['order-messages', primaryOrder.id] });
            toast.success('Refund request submitted');
          }}
        />
      )}

      <AlertDialog open={deliveredConfirmOpen} onOpenChange={setDeliveredConfirmOpen}>
        <AlertDialogContent className="max-w-[300px] rounded-2xl p-6">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-balance">
              Mark as delivered?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed text-pretty">
              The seller hasn't added tracking yet.
              Are you sure this order has arrived?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-9 rounded-lg text-sm mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onMarkDelivered?.()}
              className="flex-1 h-9 rounded-lg text-sm bg-charcoal text-white hover:bg-charcoal-light"
            >
              Yes, delivered
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
};

export default OrderDetailsSheet;

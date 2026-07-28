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
import { supabase } from '@/lib/supabase';
import { openTrackingUrl } from '@/lib/tracking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SecureCheckoutInfoPopover from '@/components/SecureCheckoutInfoPopover';
import { fetchSellerShippingSettings, getBundleBreakdownText } from '@/utils/shippingCalculator';
import { toast } from 'sonner';
import { clearOrderChatBadges } from '@/utils/orderChatRead';

interface OrderDetailsSheetProps {
  orders: Order[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkDelivered?: () => void;
  onCompleteOrder?: () => void;
}

const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case 'awaiting':
      return { label: 'Awaiting shipping', variant: 'success' as const };
    case 'shipped':
      return { label: 'Shipped', variant: 'secondary' as const };
    case 'delivered':
      return { label: 'Delivered', variant: 'secondary' as const };
    case 'completed':
      return { label: 'Completed', variant: 'secondary' as const };
    case 'refunded':
      return { label: 'Refunded', variant: 'secondary' as const };
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
  onCompleteOrder,
}: OrderDetailsSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [deliveredConfirmOpen, setDeliveredConfirmOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const { getGroupUnread } = useUnreadOrderMessages();
  const queryClient = useQueryClient();

  
  const primaryOrder = orders?.[0];
  const { data: existingReview } = useExistingReview(primaryOrder?.id);

  const isBuyer = !!user?.id && user.id === primaryOrder?.buyer_id;

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

  const shippingTotal = (orders ?? []).reduce((sum, o) => sum + Number(o.shipping_price || 0), 0);
  const { data: sellerShippingSettings } = useQuery({
    queryKey: ['seller-shipping-settings', primaryOrder?.seller_id],
    queryFn: async () => {
      if (!primaryOrder?.seller_id) return null;
      const map = await fetchSellerShippingSettings([primaryOrder.seller_id]);
      return map.get(primaryOrder.seller_id) || null;
    },
    enabled: !!primaryOrder?.seller_id && (orders?.length ?? 0) >= 2,
    staleTime: 60_000,
  });
  const bundleText = (orders?.length ?? 0) >= 2 ? getBundleBreakdownText(orders!.length, sellerShippingSettings || undefined) : null;

  if (!orders || orders.length === 0) return null;

  const subtotal = orders.reduce((sum, o) => sum + o.price + o.shipping_price, 0);
  // Buyer pays a flat Secure Checkout Fee of 4% + $0.70. Sellers pay no selling fees.
  const processingFee = Math.round((subtotal * 0.04 + 0.70) * 100) / 100;
  const total = subtotal + processingFee;
  const isRefunded = primaryOrder.status === 'refunded' || !!primaryOrder.refunded_at;
  const effectiveStatus: OrderStatus = isRefunded ? 'refunded' : primaryOrder.status;
  const refundItemOptions = useMemo(
    () =>
      orders.map((o) => ({
        orderId: o.id,
        title: o.listing?.title || 'Item',
        image: o.listing?.images?.[0] || '',
        price: Number(o.price || 0),
        shipping: Number(o.shipping_price || 0),
        alreadyRequested:
          !!o.refunded_at ||
          o.status === 'refunded' ||
          (!!o.refund_requested_at && !o.refund_declined_at),
      })),
    [orders],
  );
  const hasEligibleRefundItem = refundItemOptions.some((i) => !i.alreadyRequested);
  const refundWindowExpired = useMemo(() => {
    if (!primaryOrder?.delivered_at) return true;
    return differenceInDays(new Date(), new Date(primaryOrder.delivered_at)) >= 2;
  }, [primaryOrder?.delivered_at]);
  const canShowRefundButton = isBuyer && effectiveStatus === 'delivered' && !refundWindowExpired && hasEligibleRefundItem;
  const statusBadge = getStatusBadge(effectiveStatus);
  const formattedDate = format(new Date(primaryOrder.created_at), 'dd/MM/yyyy');

  const rawUsername = primaryOrder.seller_profile?.username || 'Unknown';
  const sellerUsername = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername;
  const sellerAvatar = primaryOrder.seller_profile?.avatar_url || getDefaultAvatar(primaryOrder.seller_id);

  const chatThreadId = primaryOrder.order_group_id || primaryOrder.id;
  const displayId = primaryOrder.order_number || chatThreadId.slice(0, 8).toUpperCase();

  const openOrderChat = () => {
    if (user?.id) {
      clearOrderChatBadges({
        queryClient,
        userId: user.id,
        threadId: chatThreadId,
        orderIds: orders.map((order) => order.id),
        role: 'buyer',
      });
    }
    onOpenChange(false);
    setTimeout(() => navigate(`/order-chat/${chatThreadId}`), 300);
  };


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
                  onClick={openOrderChat}
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
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="h-px w-full bg-border" />

                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Shipping{orders.length >= 2 ? ' (combined)' : ''}
                    </div>
                    <p className="text-sm text-foreground">+${shippingTotal.toFixed(2)}</p>
                  </div>
                  {bundleText && (
                    <div className="text-xs text-accent-foreground text-left">
                      <div><span className="mr-1">✈️</span><span className="font-bold">Bundle shipping:</span></div>
                      <div>{bundleText.detail}</div>
                    </div>
                  )}
                </div>

                <div className="h-px w-full bg-border" />

                {/* Fee line */}
                <div className="flex justify-between text-sm px-4 py-3">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    Secure Checkout Fee (4% + $0.70)
                    <SecureCheckoutInfoPopover />
                  </span>
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
                    value={isRefunded ? 'Refunded' : (effectiveStatus === 'awaiting' ? 'Awaiting shipping' : (primaryOrder.tracking_provider || 'N/A'))}
                    disabled
                    className="bg-background disabled:opacity-70"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1.5">Tracking number:</p>
                  <div className="relative">
                    <Input
                      value={isRefunded ? 'Refunded' : (effectiveStatus === 'awaiting' ? 'Awaiting shipping' : (primaryOrder.tracking_number || 'N/A'))}
                      disabled
                      className="bg-background disabled:opacity-70 pr-12"
                    />
                    {!isRefunded && effectiveStatus !== 'awaiting' && primaryOrder.tracking_number && (
                      <button
                        type="button"
                        aria-label="Copy tracking number"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(primaryOrder.tracking_number!);
                            toast.success('Tracking number copied.');
                          } catch {
                            toast.error('Could not copy.');
                          }
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 rounded-md text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
                {!isRefunded && effectiveStatus !== 'awaiting' && primaryOrder.tracking_number && (
                  <Button
                    type="button"
                    onClick={() => openTrackingUrl(primaryOrder.tracking_provider, primaryOrder.tracking_number!)}
                    className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-10"
                  >
                    ✈️ Track parcel
                  </Button>
                )}
              </div>
            </div>

            {/* Shipping Status Tracker */}
            {!isRefunded && effectiveStatus !== 'completed' && (
              <ShippingStatusTracker
                createdAt={primaryOrder.created_at}
                shippedAt={primaryOrder.shipped_at}
                deliveredAt={primaryOrder.delivered_at}
                status={effectiveStatus as 'awaiting' | 'shipped' | 'delivered'}
              />
            )}
            <div className="flex flex-col items-center space-y-3 pt-4">
              <div className="flex items-center gap-3 w-full px-4">
                {!isRefunded && (effectiveStatus === 'awaiting' || effectiveStatus === 'shipped') && (
                  <Button
                    onClick={() => {
                      if (effectiveStatus === 'awaiting') {
                        setDeliveredConfirmOpen(true);
                      } else {
                        onMarkDelivered?.();
                      }
                    }}
                    className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                  >
                    {primaryOrder.admin_marked_delivered ? 'Complete' : 'Mark as delivered'}
                  </Button>
                )}
                {!isRefunded && effectiveStatus === 'delivered' && isBuyer && (
                  <Button
                    onClick={() => setCompleteConfirmOpen(true)}
                    className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                  >
                    Complete
                  </Button>
                )}
                {!isRefunded && effectiveStatus === 'completed' && !existingReview && (
                  <Button
                    onClick={() => setReviewDrawerOpen(true)}
                    className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                  >
                    Review Seller
                  </Button>
                )}
                {!isRefunded && canShowRefundButton && (
                  <Button
                    onClick={() => {
                      if (refundStatus?.hasPending || refundStatus?.hasAnyRequest) {
                        openOrderChat();
                      } else {
                        setRefundDialogOpen(true);
                      }
                    }}
                    variant="outline"
                    className="flex-1 rounded-full h-12 bg-muted-foreground/60 text-white hover:bg-muted-foreground/70 border-none"
                  >
                    {refundStatus?.hasPending || refundStatus?.hasAnyRequest ? 'Refund Requested' : 'Request Refund'}
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
          items={refundItemOptions}
          onSubmit={async ({ selections, details, imageUploads }) => {
            let succeeded = 0;
            const failures: string[] = [];
            for (const sel of selections) {
              const order = orders.find((o) => o.id === sel.orderId);
              const combinedReason = [sel.reason, sel.note].filter(Boolean).join(' - ');
              const messageDetails = [details, sel.note].filter(Boolean).join(' — ');
              try {
                const { data, error } = await invokeCloudFunction('order-messages', {
                  method: 'POST',
                  query: { orderId: sel.orderId, action: 'refund_request' },
                  body: { reason: sel.reason, details: messageDetails, image_uploads: imageUploads },
                });
                if (error) throw new Error(typeof error === 'object' && error.message ? error.message : 'Failed to submit refund request');
                if (data && typeof data === 'object' && 'error' in data) {
                  throw new Error((data as { error: string }).error);
                }
                try {
                  await (supabase as any).rpc('request_refund', {
                    p_order_id: sel.orderId,
                    p_order_group_id: order?.order_group_id ?? primaryOrder.order_group_id ?? null,
                    p_reason: combinedReason.slice(0, 500),
                  });
                } catch (rpcErr) {
                  console.warn('[RefundRequest] request_refund RPC failed:', rpcErr);
                }
                succeeded++;
              } catch (err) {
                console.error('[RefundRequest] Item failed:', sel.orderId, err);
                failures.push(order?.listing?.title || 'Item');
              }
              queryClient.invalidateQueries({ queryKey: ['refund-status', sel.orderId] });
              queryClient.invalidateQueries({ queryKey: ['order-messages', sel.orderId] });
            }
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            if (failures.length === 0) {
              toast.success(
                selections.length === 1
                  ? 'Refund request submitted. Seller has 72 hours to respond.'
                  : `${succeeded} refund requests submitted. Seller has 72 hours to respond.`,
              );
            } else if (succeeded > 0) {
              toast.warning(`${succeeded} of ${selections.length} refund requests submitted. Please retry: ${failures.join(', ')}`);
            } else {
              throw new Error('Failed to submit refund request');
            }
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

      <AlertDialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl p-6">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-balance">
              Confirm your order?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed text-pretty">
              Happy with your order, or is there an issue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center">
            <AlertDialogAction
              onClick={() => {
                setCompleteConfirmOpen(false);
                setRefundDialogOpen(true);
              }}
              className="flex-1 h-9 rounded-lg text-sm bg-muted-foreground/60 text-white hover:bg-muted-foreground/70"
            >
              Report Issue
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setCompleteConfirmOpen(false);
                onCompleteOrder?.();
              }}
              className="flex-1 h-9 rounded-lg text-sm bg-charcoal text-white hover:bg-charcoal-light"
            >
              Confirm Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>

  );
};

export default OrderDetailsSheet;

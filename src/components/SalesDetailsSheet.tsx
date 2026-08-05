import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AU_CARRIERS, normaliseTrackingNumber, validateTrackingFormat } from '@/lib/auCarriers';

import { Badge } from '@/components/ui/badge';
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
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, OrderStatus, useOrders } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { useExistingReview } from '@/hooks/useReviews';
import WriteReviewDrawer from '@/components/WriteReviewDrawer';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import OrderReceiptDialog from '@/components/OrderReceiptDialog';
import CancelItemDialog from '@/components/CancelItemDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import ShippingStatusTracker from '@/components/ShippingStatusTracker';
import TrackingEvents from '@/components/TrackingEvents';
import { openTrackingUrl } from '@/lib/tracking';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { supabase } from '@/integrations/supabase/client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSellerShippingSettings, getBundleBreakdownText } from '@/utils/shippingCalculator';
import { computeSellerNet } from '@/utils/feeCalculator';

import { toast } from 'sonner';
import { Loader2, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearOrderChatBadges } from '@/utils/orderChatRead';

interface SalesDetailsSheetProps {
  orders: Order[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkShipped?: (trackingDetails: { serviceProvider: string; trackingNumber: string }) => void;
  highlightOrderId?: string | null;
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

const getDisplayStatusBadge = (order: Order) => {
  if (order.status === 'refunded' || order.refunded_at) return { label: 'Refunded', variant: 'secondary' as const };
  return getStatusBadge(order.status);
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
  highlightOrderId,
}: SalesDetailsSheetProps) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const stripeFullyVerified = profile?.stripe_onboarding_complete === true;
  const [serviceProvider, setServiceProvider] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [validationError, setValidationError] = useState('');
  const [verifyingTracking, setVerifyingTracking] = useState(false);

  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const { getGroupUnread } = useUnreadOrderMessages();
  const { requestRefund, respondToRefund } = useOrders();
  const [refundDeclineReason, setRefundDeclineReason] = useState('');
  const [refundDeclineOpen, setRefundDeclineOpen] = useState(false);
  const [refundActionOrderId, setRefundActionOrderId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelItemTitle, setCancelItemTitle] = useState<string | undefined>(undefined);
  const [cancelItemImage, setCancelItemImage] = useState<string | undefined>(undefined);
  const [cancelItemPrice, setCancelItemPrice] = useState<number | undefined>(undefined);
  const [refundPickerOpen, setRefundPickerOpen] = useState(false);
  const [refundSelectedIds, setRefundSelectedIds] = useState<string[]>([]);
  const [cancelItems, setCancelItems] = useState<{ id: string; title?: string; image?: string; price?: number }[]>([]);
  const toCancelTarget = (o: any) => ({
    id: o.id,
    title: o.listing?.title || 'Item',
    image: o.listing?.images?.[0] || o.listing?.image_url || undefined,
    price: Number(o.price) || 0,
  });
  const openCancelFor = (o: any) => {
    setCancelItems([toCancelTarget(o)]);
    setCancelOrderId(o.id);
    setCancelItemTitle(o.listing?.title || 'Item');
    setCancelItemImage(o.listing?.images?.[0] || o.listing?.image_url || undefined);
    setCancelItemPrice(Number(o.price) || 0);
  };
  const highlightRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const refundableOrders = (orders ?? []).filter(
    (o: any) =>
      o.status === 'awaiting' &&
      !o.shipped_at &&
      !o.refunded_at &&
      o.status !== 'refunded' &&
      !(o.refund_requested_at && !o.refund_declined_at),
  );

  useEffect(() => {
    if (!open || !highlightOrderId) return;
    const el = highlightRefs.current[highlightOrderId];
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
  }, [open, highlightOrderId, orders]);

  const primaryOrder = orders?.[0];

  const { data: existingReview } = useExistingReview(primaryOrder?.id);

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

  if (!orders || orders.length === 0 || !primaryOrder) return null;

  // Refunded items are excluded (their transfer is reversed in Stripe) and the
  // Transaction Fee comes from the snapshot stored at checkout - never today's rate.
  const sellerNet = computeSellerNet(orders as any[]);
  const shippingTotal = sellerNet.shipping;
  const transactionFee = sellerNet.transactionFee;
  const youReceived = sellerNet.youReceived;
  const fullyRefunded = sellerNet.fullyRefunded;

  const statusBadge = getDisplayStatusBadge(primaryOrder);
  const formattedDate = format(new Date(primaryOrder.created_at), 'dd/MM/yyyy');

  const bundleText = orders.length >= 2 ? getBundleBreakdownText(orders.length, sellerShippingSettings || undefined) : null;


  const handleMarkShipped = async () => {
    if (verifyingTracking) return;
    const formatError = validateTrackingFormat(serviceProvider, trackingNumber);
    if (formatError) {
      setValidationError(formatError);
      return;
    }
    setValidationError('');
    const cleanNumber = normaliseTrackingNumber(trackingNumber);

    // Live check with the carrier before the order flips to shipped.
    setVerifyingTracking(true);
    try {
      const { data, error } = await supabase.functions.invoke('tracking-register', {
        body: { validate_only: true, carrier: serviceProvider, tracking_number: cleanNumber },
      });
      if (!error && data && data.valid === false) {
        setValidationError(
          data.message ||
            `That tracking number wasn't recognised by ${serviceProvider}. Check it and try again.`,
        );
        setVerifyingTracking(false);
        return;
      }
    } catch (err) {
      // Never block shipping on a provider outage - the daily sync will catch up.
      console.warn('Tracking validation unavailable:', err);
    }
    setVerifyingTracking(false);
    onMarkShipped?.({ serviceProvider: serviceProvider.trim(), trackingNumber: cleanNumber });
  };


  const rawBuyerUsername = primaryOrder.buyer_profile?.username || 'Unknown';
  const buyerUsername = rawBuyerUsername.startsWith('@') ? rawBuyerUsername.slice(1) : rawBuyerUsername;
  const buyerAvatar = primaryOrder.buyer_profile?.avatar_url || getDefaultAvatar(primaryOrder.buyer_id);

  const isRefunded = primaryOrder.status === 'refunded' || !!primaryOrder.refunded_at;
  const effectiveStatus: OrderStatus = isRefunded ? 'refunded' : primaryOrder.status;
  const refundWindowExpired = !primaryOrder?.delivered_at || (() => {
    const hoursSinceDelivery = (Date.now() - new Date(primaryOrder.delivered_at).getTime()) / (1000 * 60 * 60);
    return hoursSinceDelivery >= 48;
  })();
  const canRefundSale = effectiveStatus === 'delivered' && !refundWindowExpired;
  const providers = Array.from(new Set(orders.map((o) => o.tracking_provider).filter(Boolean) as string[]));
  const numbers = Array.from(new Set(orders.map((o) => o.tracking_number).filter(Boolean) as string[]));
  const trackingProviderDisplay = isRefunded
    ? 'Refunded'
    : (effectiveStatus === 'awaiting' ? 'Awaiting shipping' : (providers.length === 1 ? providers[0] : 'Multiple'));
  const trackingNumberDisplay = isRefunded
    ? 'Refunded'
    : (effectiveStatus === 'awaiting' ? 'Awaiting shipping' : (numbers.length === 1 ? numbers[0] : 'Multiple'));

  const chatThreadId = primaryOrder.order_group_id || primaryOrder.id;
  const openSaleChat = () => {
    if (user?.id) {
      clearOrderChatBadges({
        queryClient,
        userId: user.id,
        threadId: chatThreadId,
        orderIds: orders.map((order) => order.id),
        role: 'seller',
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
                onClick={openSaleChat}
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
                    const itemRefunded = o.status === 'refunded' || !!o.refunded_at;
                    const itemDeclined = !itemRefunded && !!o.refund_declined_at && !o.refund_requested_at;
                    const itemPending = !itemRefunded && !!o.refund_requested_at && !o.refund_declined_at;
                    const itemPill = itemRefunded
                      ? { label: 'Refunded', className: 'bg-muted text-muted-foreground' }
                      : itemPending
                        ? { label: 'Refund requested', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' }
                        : itemDeclined
                          ? { label: 'Refund declined', className: 'bg-muted text-muted-foreground' }
                          : null;

                    const isHighlighted = highlightOrderId === o.id;
                    return (
                      <div
                        key={o.id}
                        ref={(el) => { highlightRefs.current[o.id] = el; }}
                        className={`flex gap-4 p-2 -m-2 rounded-xl transition-all ${isHighlighted ? 'ring-2 ring-primary bg-primary/10' : ''}`}
                      >
                        <img
                          src={listingImage}
                          alt={listingTitle}
                          className="h-20 w-20 rounded-xl object-cover bg-muted"
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{listingTitle}</h3>
                            {itemPill && (
                              <span className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${itemPill.className}`}>
                                {itemPill.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-end justify-end gap-2">
                            <p className="text-lg font-semibold">${o.price}</p>
                          </div>
                        </div>

                      </div>
                    );

                  })}
                </div>

                <div className="h-px w-full bg-border" />

                <div className="px-4 py-3 space-y-2">
                  {(() => {
                    const itemsSubtotal = (orders as any[])
                      .filter((o) => !(o.refunded_at || o.status === 'refunded'))
                      .reduce((sum, o) => sum + Number(o.price || 0), 0);
                    return (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Items subtotal{orders.length >= 2 ? ` (${orders.length} items)` : ''}
                        </div>
                        <p className="text-sm text-foreground">${itemsSubtotal.toFixed(2)}</p>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Shipping{orders.length >= 2 ? ' (combined)' : ''}
                    </div>
                    <p className="text-sm text-foreground">+${shippingTotal.toFixed(2)}</p>
                  </div>
                  {bundleText && (
                    <div className="text-xs text-accent-foreground text-left">
                      <div><span className="mr-1">{bundleText.emoji}</span><span className="font-bold">{bundleText.label}</span></div>
                      <div>{bundleText.detail}</div>
                    </div>
                  )}
                </div>

                {/* Fees last. Hidden when no fee was charged (pre-fee sales) so it doesn't read as a bug. */}
                {!fullyRefunded && transactionFee > 0 && (
                  <>
                    <div className="h-px w-full bg-border" />
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-sm text-muted-foreground">Transaction Fee (2% + $0.50)</div>
                      <p className="text-sm text-foreground">−${transactionFee.toFixed(2)}</p>
                    </div>
                  </>
                )}

                <div className="h-px w-full bg-border" />


                {/* Total */}
                <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                  <span className="font-medium">
                    {fullyRefunded
                      ? 'Refunded: $0.00'
                      : `You received: $${youReceived.toFixed(2)}`}
                  </span>
                </div>

              </div>
            </div>

            {/* Tracking Details Section - Editable for awaiting status */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Tracking Details</SectionHeader>
              <div className="p-4 space-y-3">
                {effectiveStatus === 'awaiting' && !isRefunded ? (
                  <>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Service Provider:</p>
                      <Select value={serviceProvider} onValueChange={setServiceProvider}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Choose carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          {AU_CARRIERS.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1.5">Tracking number:</p>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => {
                          setTrackingNumber(e.target.value);
                          if (validationError) setValidationError('');
                        }}
                        placeholder="Enter tracking number"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
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
                    {!isRefunded && trackingNumberDisplay && trackingNumberDisplay !== 'Multiple' && (
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
                        ✈️ Track parcel
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Shipping Status Tracker - visible once shipped, hidden if refunded */}
            {!isRefunded && (effectiveStatus === 'shipped' || effectiveStatus === 'delivered') && (
              <>
                <ShippingStatusTracker
                  createdAt={primaryOrder.created_at}
                  shippedAt={primaryOrder.shipped_at}
                  deliveredAt={primaryOrder.delivered_at}
                  status={effectiveStatus}
                />
                <TrackingEvents orderGroupId={primaryOrder.order_group_id ?? primaryOrder.id} />
              </>
            )}
            {!isRefunded && effectiveStatus === 'awaiting' && (
              <div className="flex flex-col items-center space-y-3 w-full px-4">
                <Button
                  onClick={handleMarkShipped}
                  className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                >
                  Mark as shipped
                </Button>
                {refundableOrders.length > 0 && (
                  <Button
                    onClick={() => {
                      if (refundableOrders.length === 1) {
                        openCancelFor(refundableOrders[0]);
                      } else {
                        setRefundPickerOpen(true);
                      }
                    }}
                    variant="outline"
                    className="w-full rounded-full h-12 bg-muted-foreground/60 text-white hover:bg-muted-foreground/70 border-none"
                  >
                    Refund item
                  </Button>
                )}
              </div>
            )}


            {/* Seller Dashboard entry (replaces payment & payout / Stripe links) */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setTimeout(() => navigate('/seller-dashboard'), 250);
              }}
              className="flex items-center justify-between w-full rounded-2xl bg-card p-4 pl-6 card-shadow cursor-pointer"
            >
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold text-foreground">📈 Seller dashboard</span>
                <span className="text-xs text-muted-foreground mt-0.5">View payouts</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Pending refund requests from buyer — per item */}
            {(() => {
              const pending = orders.filter(
                (o) =>
                  o.refund_requested_at &&
                  !o.refund_declined_at &&
                  !o.refunded_at &&
                  o.status !== 'refunded' &&
                  o.refund_requested_by === o.buyer_id,
              );
              if (pending.length === 0) return null;
              const multi = orders.length > 1;
              return (
                <div className="space-y-3">
                  {pending.map((o) => (
                    <div key={o.id} className="rounded-2xl bg-card border border-border p-4 space-y-3">
                      <div className="flex gap-3">
                        {multi && o.listing?.images?.[0] && (
                          <img
                            src={o.listing.images[0]}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {multi ? `Refund requested — ${o.listing?.title || 'Item'}` : 'Buyer requested a refund'}
                          </p>
                          {o.refund_request_reason && (
                            <p className="text-xs text-muted-foreground mt-1">"{o.refund_request_reason}"</p>
                          )}
                          {o.refund_request_deadline_at && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Auto-approves {format(new Date(o.refund_request_deadline_at), 'MMM d, h:mma')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-full h-10"
                          onClick={() => {
                            setRefundActionOrderId(o.id);
                            setRefundDeclineOpen(true);
                          }}
                          disabled={respondToRefund.isPending}
                        >
                          Decline
                        </Button>
                        <Button
                          className="flex-1 rounded-full h-10 bg-charcoal text-white hover:bg-charcoal-light"
                          onClick={async () => {
                            setRefundActionOrderId(o.id);
                            await respondToRefund.mutateAsync({
                              orderId: o.id,
                              decision: 'approve',
                            });
                            setRefundActionOrderId(null);
                          }}
                          disabled={respondToRefund.isPending}
                        >
                          {respondToRefund.isPending && refundActionOrderId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve refund'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex flex-col items-center space-y-3 pt-4">
              <div className="flex items-center justify-center gap-3 w-full px-4">
                {!isRefunded && canRefundSale && (
                  <Button
                    onClick={() => setRefundConfirmOpen(true)}
                    variant="outline"
                    className="rounded-full h-12 px-12 bg-muted-foreground/60 text-white hover:bg-muted-foreground/70 border-none"
                  >
                    Refund sale
                  </Button>
                )}
                {!isRefunded && effectiveStatus === 'delivered' && !existingReview && (
                  <Button
                    onClick={() => setReviewDrawerOpen(true)}
                    className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
                  >
                    Review Buyer
                  </Button>
                )}
              </div>
              <button
                className="text-center text-sm text-foreground underline mt-4"
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

      <AlertDialog open={refundConfirmOpen} onOpenChange={(o) => !refunding && setRefundConfirmOpen(o)}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              The full amount will be returned to the buyer and taken out of your Flea balance. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel disabled={refunding} className="flex-1 h-9 rounded-lg mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={refunding}
              onClick={async (e) => {
                e.preventDefault();
                if (!primaryOrder) return;
                setRefunding(true);
                try {
                  const res: any = await invokeCloudFunction(
                    'stripe-connect-refund',
                    { orderId: primaryOrder.id, reason: 'requested_by_customer' }
                  );
                  if (res?.error || !res?.data?.success) {
                    throw new Error(res?.error?.message || res?.data?.error || 'Refund failed');
                  }
                  toast.success('Refund issued. Buyer has been notified.');
                  await queryClient.invalidateQueries({ queryKey: ['orders'] });
                  await queryClient.invalidateQueries({ queryKey: ['seller-balance'] });
                  setRefundConfirmOpen(false);
                  onOpenChange(false);
                } catch (err: any) {
                  toast.error(err?.message || 'Could not process refund. Please try again.');
                } finally {
                  setRefunding(false);
                }
              }}
              className="flex-1 h-9 rounded-lg bg-charcoal text-white hover:bg-charcoal-light"
            >
              {refunding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refund'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refundDeclineOpen} onOpenChange={(o) => !respondToRefund.isPending && setRefundDeclineOpen(o)}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl p-6">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle>Decline refund request?</AlertDialogTitle>
            <AlertDialogDescription>
              Add a short reason. The buyer can still escalate to Flea admin for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={refundDeclineReason}
            onChange={(e) => setRefundDeclineReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={200}
            className="mt-2"
          />
          <AlertDialogFooter className="flex-row gap-2 mt-3">
            <AlertDialogCancel disabled={respondToRefund.isPending} className="flex-1 h-9 rounded-lg mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={respondToRefund.isPending}
              onClick={async (e) => {
                e.preventDefault();
                const targetOrderId = refundActionOrderId ?? primaryOrder.id;
                await respondToRefund.mutateAsync({
                  orderId: targetOrderId,
                  decision: 'decline',
                  reason: refundDeclineReason,
                });
                setRefundDeclineReason('');
                setRefundDeclineOpen(false);
                setRefundActionOrderId(null);
              }}
              className="flex-1 h-9 rounded-lg bg-charcoal text-white hover:bg-charcoal-light"
            >
              {respondToRefund.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={refundPickerOpen} onOpenChange={(o) => { setRefundPickerOpen(o); if (!o) setRefundSelectedIds([]); }}>
        <DialogContent className="max-w-[85vw] sm:max-w-sm rounded-2xl z-[110] max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Refund items</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Step 1 of 2 • Select items</p>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {refundableOrders.map((o: any) => {
              const checked = refundSelectedIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() =>
                    setRefundSelectedIds((prev) =>
                      prev.includes(o.id) ? prev.filter((id) => id !== o.id) : [...prev, o.id]
                    )
                  }
                  className={cn(
                    'w-full flex gap-3 items-center text-left rounded-xl border bg-card p-3 transition-colors',
                    checked ? 'border-charcoal bg-charcoal/5' : 'border-border hover:bg-secondary'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md border-2 shrink-0',
                      checked ? 'border-charcoal bg-charcoal' : 'border-muted-foreground/40'
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <img
                    src={o.listing?.images?.[0] || o.listing?.image_url || ''}
                    alt=""
                    className="h-14 w-14 rounded-lg object-cover bg-muted shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{o.listing?.title || 'Item'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">${Number(o.price || 0).toFixed(2)}</p>
                  </div>
                </button>
              );
            })}
            {refundableOrders.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setRefundSelectedIds(
                    refundSelectedIds.length === refundableOrders.length
                      ? []
                      : refundableOrders.map((o: any) => o.id)
                  )
                }
                className="w-full text-center text-xs font-medium text-muted-foreground underline py-1"
              >
                {refundSelectedIds.length === refundableOrders.length ? 'Clear selection' : 'Select all items'}
              </button>
            )}
            <Button
              disabled={refundSelectedIds.length === 0}
              onClick={() => {
                const selected = refundableOrders.filter((o: any) => refundSelectedIds.includes(o.id));
                setCancelItems(selected.map(toCancelTarget));
                setCancelOrderId(selected[0]?.id ?? null);
                setRefundPickerOpen(false);
                setRefundSelectedIds([]);
              }}
              className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 mt-1"
            >
              {refundSelectedIds.length > 1 ? `Refund ${refundSelectedIds.length} items` : 'Refund item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CancelItemDialog
        orderId={cancelOrderId}
        itemTitle={cancelItemTitle}
        itemImage={cancelItemImage}
        itemPrice={cancelItemPrice}
        items={cancelItems}
        open={!!cancelOrderId}
        onOpenChange={(o) => { if (!o) { setCancelOrderId(null); setCancelItems([]); } }}
      />


    </Drawer>
  );
};

export default SalesDetailsSheet;

import { useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Order } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { X, Download } from 'lucide-react';
import fleaLogo from '@/assets/flea-logo-receipt.jpeg';
import stripeLogo from '@/assets/logo-stripe.png';
import { useQuery } from '@tanstack/react-query';
import {
  fetchSellerShippingSettings,
  getBundleBreakdownText,
  calculateBundleShippingTotal,
  type BundleShippingMode,
} from '@/utils/shippingCalculator';
import {
  calculateProRataRefund,
  calculateSecureCheckoutFee,
  calculateTransactionFee,
} from '@/utils/feeCalculator';



interface OrderReceiptDialogProps {
  orders: Order[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewAs: 'buyer' | 'seller';
}

const OrderReceiptDialog = ({ orders, open, onOpenChange, viewAs }: OrderReceiptDialogProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!receiptRef.current) return;
    try {
      // Before capture, nudge the stripe logo down so html2canvas aligns it properly
      const stripeImg = receiptRef.current.querySelector('img[alt="Stripe"]') as HTMLImageElement | null;
      if (stripeImg) stripeImg.style.position = 'relative';
      if (stripeImg) stripeImg.style.top = '6px';

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 4,
        useCORS: true,
        width: receiptRef.current.scrollWidth,
        height: receiptRef.current.scrollHeight,
        windowWidth: receiptRef.current.scrollWidth,
        windowHeight: receiptRef.current.scrollHeight,
      });

      // Revert the nudge
      if (stripeImg) { stripeImg.style.position = ''; stripeImg.style.top = ''; }

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `flea-receipt-${displayId}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          const link = document.createElement('a');
          link.download = `flea-receipt-${displayId}.png`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
      }, 'image/png');
    } catch {
      const text = receiptRef.current?.innerText || '';
      await navigator.clipboard.writeText(text);
    }
  }, []);

  const primaryOrder = orders?.[0];
  if (!primaryOrder) return null;

  const formattedDate = format(new Date(primaryOrder.created_at), 'MMM dd, yyyy');
  const displayId = primaryOrder.order_number || (primaryOrder.order_group_id || primaryOrder.id).slice(0, 8).toUpperCase();

  const rawBuyerUsername = primaryOrder.buyer_profile?.username || 'Buyer';
  const buyerUsername = rawBuyerUsername.startsWith('@') ? rawBuyerUsername.slice(1) : rawBuyerUsername;
  const rawSellerUsername = primaryOrder.seller_profile?.username || 'Seller';
  const sellerUsername = rawSellerUsername.startsWith('@') ? rawSellerUsername.slice(1) : rawSellerUsername;

  const { data: sellerShippingSettings } = useQuery({
    queryKey: ['seller-shipping-settings', primaryOrder.seller_id],
    queryFn: async () => {
      const map = await fetchSellerShippingSettings([primaryOrder.seller_id]);
      return map.get(primaryOrder.seller_id) || null;
    },
    enabled: open && !!primaryOrder.seller_id && orders.length >= 2,
    staleTime: 60_000,
  });

  const bundleMode = (sellerShippingSettings?.mode || 'none') as BundleShippingMode;
  const discountPercent = sellerShippingSettings?.discountPercent ?? null;
  // Use the historical shipping price captured on the order row at checkout,
  // not the current listing price (which can change or the listing can be
  // deleted). This keeps the receipt matching the amount actually charged.
  const rawShippings = orders.map((o) => Number(o.shipping_price) || 0);
  const bundleShippingTotal = calculateBundleShippingTotal(rawShippings, bundleMode, discountPercent);

  const rawShippingTotal = Math.round(rawShippings.reduce((a, b) => a + b, 0) * 100) / 100;
  const itemSubtotals = orders.map((o, idx) => {
    const share = rawShippingTotal > 0
      ? Math.round(bundleShippingTotal * (rawShippings[idx] / rawShippingTotal) * 100) / 100
      : 0;
    return Math.round((o.price + share) * 100) / 100;
  });
  const subtotal = Math.round(itemSubtotals.reduce((a, b) => a + b, 0) * 100) / 100;

  // Fees ACTUALLY charged, snapshotted on the order rows at checkout. Only fall
  // back to recalculating for legacy orders created before the snapshot existed
  // — recalculating ignores coupons and would show a total the buyer never paid.
  const savedSecureFee = orders.reduce(
    (sum, o) => sum + (Number((o as any).secure_checkout_fee) || 0), 0);
  const hasSavedSecureFee = orders.some((o) => (o as any).secure_checkout_fee != null);
  const savedTransactionFee = orders.reduce(
    (sum, o) => sum + (Number((o as any).transaction_fee) || 0), 0);
  const hasSavedTransactionFee = orders.some((o) => (o as any).transaction_fee != null);
  const couponCode = orders.find((o) => (o as any).coupon_code)?.['coupon_code' as keyof typeof orders[0]] as string | undefined;

  const secureCheckoutFee = hasSavedSecureFee
    ? Math.round(savedSecureFee * 100) / 100
    : calculateSecureCheckoutFee(subtotal);
  const buyerTotal = Math.round((subtotal + secureCheckoutFee) * 100) / 100;
  // Seller-paid Transaction Fee (2% + $0.50) deducted from payout.
  const transactionFee = hasSavedTransactionFee
    ? Math.round(savedTransactionFee * 100) / 100
    : calculateTransactionFee(subtotal);
  const sellerReceives = Math.round((subtotal - transactionFee) * 100) / 100;

  const bundleText = orders.length >= 2 ? getBundleBreakdownText(orders.length, sellerShippingSettings || undefined) : null;

  // Partial refund breakdown (per-item, pro-rata shipping and fees).
  const refundItems = orders
    .map((o, idx) => ({ order: o, idx }))
    .filter(({ order }) => order.status === 'refunded' || !!order.refunded_at);
  const refundBreakdowns = refundItems.map(({ order, idx }) => ({
    order,
    ...calculateProRataRefund(
      idx,
      orders.map((o, i) => ({ price: o.price, rawShipping: rawShippings[i] })),
      bundleMode,
      discountPercent,
      { secureCheckoutFee, transactionFee },
    ),
  }));
  const buyerRefundTotal = refundBreakdowns.reduce((s, r) => s + r.buyerRefund, 0);
  const sellerRefundTotal = refundBreakdowns.reduce((s, r) => s + r.sellerNet, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] p-0 rounded-none border-none bg-transparent shadow-none overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">Receipt</DialogTitle>

        {/* Receipt card */}
        <div className="relative">
          {/* Jagged top edge - visual only, excluded from download */}
          <svg className="w-full block" height="12" preserveAspectRatio="none" viewBox="0 0 360 12" style={{ display: 'block', marginBottom: '-1px' }}>
            <path d="M0,12 L0,6 L6,0 L12,6 L18,0 L24,6 L30,0 L36,6 L42,0 L48,6 L54,0 L60,6 L66,0 L72,6 L78,0 L84,6 L90,0 L96,6 L102,0 L108,6 L114,0 L120,6 L126,0 L132,6 L138,0 L144,6 L150,0 L156,6 L162,0 L168,6 L174,0 L180,6 L186,0 L192,6 L198,0 L204,6 L210,0 L216,6 L222,0 L228,6 L234,0 L240,6 L246,0 L252,6 L258,0 L264,6 L270,0 L276,6 L282,0 L288,6 L294,0 L300,6 L306,0 L312,6 L318,0 L324,6 L330,0 L336,6 L342,0 L348,6 L354,0 L360,6 L360,12 Z" fill="white"/>
          </svg>

          {/* Downloadable receipt area - no jagged edges */}
          <div ref={receiptRef} className="bg-white px-6 pt-6 pb-4">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="bg-white">
                <img src={fleaLogo} alt="Flea" className="h-8 object-contain" />
              </div>
            </div>

            {/* Order info */}
            <div className="border-t border-dotted border-gray-300 py-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Sale date</span>
                <span className="font-medium text-gray-900">{formattedDate}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Order</span>
                <span className="font-medium text-gray-900">#{displayId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Buyer</span>
                <span className="font-medium text-gray-900">@{buyerUsername}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Seller</span>
                <span className="font-medium text-gray-900">@{sellerUsername}</span>
              </div>
            </div>

            {/* Items breakdown */}
            <div className="border-t border-dotted border-gray-300 pt-4 pb-1 space-y-4">
              {orders.map((o, idx) => {
                const isRefunded = o.status === 'refunded' || !!o.refunded_at;
                const itemSubtotal = itemSubtotals[idx];
                return (
                  <div key={o.id}>
                    <p className={`font-semibold text-xs ${isRefunded ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {o.listing?.title || 'Item'}
                    </p>
                    <div className="flex justify-between text-xs mt-0.5">
                      <span className="text-gray-500">Item price</span>
                      <span className={isRefunded ? 'text-gray-500 line-through' : 'text-gray-900'}>${o.price.toFixed(2)}</span>
                    </div>
                    {orders.length >= 2 && (
                      <div className="flex justify-between text-xs mt-0.5">
                        <span className="text-gray-500">Shipping share</span>
                        <span className={isRefunded ? 'text-gray-500 line-through' : 'text-gray-900'}>${(itemSubtotal - o.price).toFixed(2)}</span>
                      </div>
                    )}
                    {isRefunded && (
                      <div className="text-[10px] font-semibold text-destructive mt-0.5">Refunded</div>
                    )}
                  </div>
                );
              })}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Shipping{orders.length >= 2 ? ' (combined)' : ''}</span>
                  <span className="text-gray-900">${bundleShippingTotal.toFixed(2)}</span>
                </div>
                {bundleText && (
                  <div className="text-[10px] text-gray-500 text-left mt-0.5">
                    <div><span className="mr-1">✈️</span><span className="font-bold">Bundle shipping:</span></div>
                    <div>{bundleText.detail}</div>
                  </div>
                )}
              </div>

              <div className="border-t border-dotted border-gray-300 pt-3 space-y-1.5">
                {viewAs === 'buyer' ? (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">
                        Secure Checkout Fee{secureCheckoutFee > 0 ? ' (4% + $0.70)' : ''}
                      </span>
                      <span className="text-gray-900">+${secureCheckoutFee.toFixed(2)}</span>
                    </div>
                    {couponCode && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Coupon {couponCode}</span>
                        <span className="text-gray-900">Fee waived</span>
                      </div>
                    )}
                    {refundBreakdowns.length > 0 && (
                      <div className="flex justify-between text-xs text-destructive">
                        <span>Refund</span>
                        <span>−${buyerRefundTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold pt-1">
                      <span className="text-gray-900">{refundBreakdowns.length > 0 ? 'Net paid' : 'Total paid'}</span>
                      <span className="text-gray-900">${(buyerTotal - buyerRefundTotal).toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Transaction Fee (2% + $0.50)</span>
                      <span className="text-gray-900">−${transactionFee.toFixed(2)}</span>
                    </div>
                    {refundBreakdowns.length > 0 && (
                      <div className="flex justify-between text-xs text-destructive">
                        <span>Refund reversal</span>
                        <span>−${sellerRefundTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold pt-1">
                      <span className="text-gray-900">{refundBreakdowns.length > 0 ? 'Net received' : 'You received'}</span>
                      <span className="text-gray-900">${(sellerReceives - sellerRefundTotal).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment processor */}
            <div className="border-t border-dotted border-gray-300 mt-4 pt-4 pb-3 flex items-center justify-center gap-1.5">
              <span className="text-[10px] text-gray-400">Processed by</span>
              <img src={stripeLogo} alt="Stripe" className="h-4 object-contain" style={{ mixBlendMode: 'darken' }} />
            </div>
          </div>

          {/* Jagged bottom edge - visual only, excluded from download */}
          <svg className="w-full block -mt-px" height="12" preserveAspectRatio="none" viewBox="0 0 360 12" style={{ display: 'block', margin: '-1px auto 0' }}>
            <path d="M0,0 L0,6 L6,12 L12,6 L18,12 L24,6 L30,12 L36,6 L42,12 L48,6 L54,12 L60,6 L66,12 L72,6 L78,12 L84,6 L90,12 L96,6 L102,12 L108,6 L114,12 L120,6 L126,12 L132,6 L138,12 L144,6 L150,12 L156,6 L162,12 L168,6 L174,12 L180,6 L186,12 L192,6 L198,12 L204,6 L210,12 L216,6 L222,12 L228,6 L234,12 L240,6 L246,12 L252,6 L258,12 L264,6 L270,12 L276,6 L282,12 L288,6 L294,12 L300,6 L306,12 L312,6 L318,12 L324,6 L330,12 L336,6 L342,12 L348,6 L354,12 L360,6 L360,0 Z" fill="white"/>
          </svg>

          {/* Action buttons overlaid on the receipt */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-6 left-3 p-1.5"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={handleDownload}
            className="absolute top-6 right-3 p-1.5"
          >
            <Download className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderReceiptDialog;

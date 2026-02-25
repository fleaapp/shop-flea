import { useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Order } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { X, Download } from 'lucide-react';
import fleaLogo from '@/assets/flea-logo-receipt.jpeg';
import stripeLogo from '@/assets/logo-stripe.jpeg';
import paypalLogo from '@/assets/logo-paypal.png';

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
      // Convert to blob and use share API to save to photos (mobile), fallback to download
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

  const itemsSubtotal = orders.reduce((sum, o) => sum + o.price, 0);
  const shippingTotal = orders.reduce((sum, o) => sum + o.shipping_price, 0);
  const subtotal = itemsSubtotal + shippingTotal;
  const processingFee = subtotal * 0.02;
  const platformFee = subtotal * 0.07;
  const buyerTotal = subtotal + processingFee;
  const sellerReceives = subtotal - platformFee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] p-0 rounded-none border-none bg-transparent shadow-none overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">Receipt</DialogTitle>

        {/* Receipt card */}
        <div className="relative">
          {/* Jagged top edge - visual only, excluded from download */}
          <svg className="w-full block" height="12" preserveAspectRatio="none" viewBox="0 0 360 12">
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
              {orders.map((o) => (
                <div key={o.id}>
                  <p className="font-semibold text-gray-900 text-xs">
                    {o.listing?.title || 'Item'}
                  </p>
                  <div className="flex justify-between text-xs mt-0.5">
                    <span className="text-gray-500">Item price</span>
                    <span className="text-gray-900">${o.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Shipping</span>
                    <span className="text-gray-900">${o.shipping_price.toFixed(2)}</span>
                  </div>
                </div>
              ))}

              <div className="border-t border-dotted border-gray-300 pt-3 space-y-1.5">
                {viewAs === 'buyer' ? (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Processing fee (2%)</span>
                      <span className="text-gray-900">+${processingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-1">
                      <span className="text-gray-900">Total paid</span>
                      <span className="text-gray-900">${buyerTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Platform fee (7%)</span>
                      <span className="text-gray-900">-${platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-1">
                      <span className="text-gray-900">You received</span>
                      <span className="text-gray-900">${sellerReceives.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment processor */}
            <div className="border-t border-dotted border-gray-300 mt-4 pt-4 pb-3 text-center">
              <span className="text-[10px] text-gray-400" style={{ verticalAlign: 'bottom' }}>Processed by</span>
              <img src={stripeLogo} alt="Stripe" className="h-4 inline-block ml-1.5" style={{ mixBlendMode: 'darken', verticalAlign: 'bottom' }} />
            </div>
          </div>

          {/* Jagged bottom edge - visual only, excluded from download */}
          <svg className="w-full block" height="12" preserveAspectRatio="none" viewBox="0 0 360 12">
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

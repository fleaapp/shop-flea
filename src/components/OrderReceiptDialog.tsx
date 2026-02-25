import { useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Order } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { X, Download } from 'lucide-react';
import fleaLogo from '@/assets/flea-logo-transparent.png';

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
      const link = document.createElement('a');
      link.download = `flea-receipt-${displayId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
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
          <div ref={receiptRef} className="relative bg-white overflow-hidden">
            {/* Scallop top edge */}
            <div className="h-4 w-full flex">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex-1 h-4 bg-transparent rounded-b-full" style={{ backgroundColor: 'transparent' }} />
              ))}
            </div>

            <div className="px-6 pt-2 pb-2">
              {/* Logo */}
              <div className="flex justify-center mb-4">
                <img src={fleaLogo} alt="Flea" className="h-8 object-contain" />
              </div>

              {/* Order info */}
              <div className="border-t border-gray-200 py-3 space-y-1.5">
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
              <div className="border-t border-gray-200 pt-3 space-y-3">
                {orders.map((o) => (
                  <div key={o.id}>
                    <p className="font-semibold text-gray-900 text-xs truncate">
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

                <div className="border-t border-gray-100 pt-2 space-y-1">
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
              <div className="border-t border-gray-200 mt-3 pt-3 pb-2 flex items-center justify-center gap-2">
                <span className="text-[10px] text-gray-400">Processed by</span>
                <svg viewBox="0 0 60 25" className="h-5 w-auto" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24.8 4.6c-1.8 0-3.4.9-3.4 2.6 0 2 2.7 2.1 2.7 3.1 0 .4-.5.8-1.2.8-.7 0-1.5-.3-2.1-.7l-.4 1.8c.7.3 1.4.5 2.4.5 2 0 3.5-1 3.5-2.7 0-2.1-2.7-2.2-2.7-3.1 0-.3.4-.7 1.1-.7.5 0 1.2.2 1.7.5l.4-1.7c-.6-.3-1.3-.4-2-.4zm-8.2.2l-2.3 11.5h2.2L18.8 4.8h-2.2zm13 0l-1.4 7.2-1.4-7.2h-2l2.4 10.1-.1.5c-.2.5-.5.7-1 .7-.2 0-.5 0-.7-.1l-.3 1.8c.3.1.8.1 1.1.1 1.5 0 2.3-.7 3-2.5L32.8 4.8h-2.2v0h-1zm11.6 0c-.4 0-.8.2-1 .6l-3.4 8.2-.1-.1 1.3-7.7h-2l-2.2 10.5h2l1.3-3.1.4-1c.2.7.3 1 .3 1l.9 3.1H40l3.5-8.2-.7-3.5c0-.4-.3-.8-.7-.8h-1.9v.1.1-.2z" fill="#1a1f71"/>
                  <path d="M50.5 4.6c-3.3 0-5.6 2.4-5.6 5.6 0 3.3 2.3 5.6 5.6 5.6s5.6-2.3 5.6-5.6c0-3.2-2.3-5.6-5.6-5.6zm0 9.2c-1.9 0-3.4-1.6-3.4-3.6s1.5-3.6 3.4-3.6 3.4 1.6 3.4 3.6-1.5 3.6-3.4 3.6z" fill="#1a1f71" opacity="0"/>
                </svg>
                <span className="text-xs font-semibold text-[#635bff]">stripe</span>
              </div>
            </div>

            {/* Scallop bottom edge */}
            <div className="h-4 w-full flex">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex-1 h-4 rounded-t-full" style={{ backgroundColor: 'transparent' }} />
              ))}
            </div>
          </div>

          {/* Action buttons overlaid on the receipt */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-6 left-3 p-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={handleDownload}
            className="absolute top-6 right-3 p-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm"
          >
            <Download className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderReceiptDialog;

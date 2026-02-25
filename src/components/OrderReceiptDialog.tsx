import { useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `flea-receipt.png`;
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
      <DialogContent className="max-w-[360px] p-0 rounded-2xl border-none bg-muted/80 backdrop-blur-sm overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">Receipt</DialogTitle>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5 text-foreground" />
          </button>
          <span className="font-semibold text-foreground">Your receipt</span>
          <button onClick={handleDownload}>
            <Download className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Receipt card */}
        <div className="px-4 pb-6">
          <div ref={receiptRef} className="relative bg-white rounded-xl overflow-hidden">
            {/* Scallop top edge */}
            <div className="h-4 w-full flex">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="flex-1 h-4 bg-muted/80 rounded-b-full" />
              ))}
            </div>

            <div className="px-6 pt-4 pb-2">
              {/* Logo */}
              <div className="flex justify-center mb-6">
                <img src={fleaLogo} alt="Flea" className="h-10 object-contain" />
              </div>

              {/* Order info */}
              <div className="border-t-2 border-dashed border-muted-foreground/20 py-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sale date</span>
                  <span className="font-medium text-foreground">{formattedDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-medium text-foreground">#{displayId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Buyer</span>
                  <span className="font-medium text-foreground">@{buyerUsername}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Seller</span>
                  <span className="font-medium text-foreground">@{sellerUsername}</span>
                </div>
              </div>

              {/* Items breakdown */}
              <div className="border-t-2 border-dashed border-muted-foreground/20 pt-4 space-y-3">
                {orders.map((o) => (
                  <div key={o.id}>
                    <p className="font-semibold text-foreground text-sm truncate">
                      {o.listing?.title || 'Item'}
                    </p>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Item price</span>
                      <span className="text-foreground">${o.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-foreground">${o.shipping_price.toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                <div className="border-t border-muted-foreground/10 pt-2 space-y-1">
                  {viewAs === 'buyer' ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Processing fee (2%)</span>
                        <span className="text-foreground">+${processingFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1">
                        <span className="text-foreground">Total paid</span>
                        <span className="text-foreground">${buyerTotal.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Platform fee (7%)</span>
                        <span className="text-foreground">-${platformFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1">
                        <span className="text-foreground">You received</span>
                        <span className="text-foreground">${sellerReceives.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Scallop bottom edge */}
            <div className="h-4 w-full flex">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="flex-1 h-4 bg-muted/80 rounded-t-full" />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderReceiptDialog;

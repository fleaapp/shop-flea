import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { calculateFees } from '@/utils/feeCalculator';

interface PriceBreakdownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  price: number;
  shipping?: number | null;
}

const PriceBreakdownDrawer = ({ open, onOpenChange, price, shipping }: PriceBreakdownDrawerProps) => {
  const itemPrice = Number(price || 0);
  const shippingPrice = Number(shipping || 0);
  const fees = calculateFees(itemPrice, shippingPrice);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="fixed top-10 bottom-0 left-0 right-0 flex flex-col rounded-t-3xl">
        <DrawerHeader className="shrink-0 px-4 pb-2 pt-3">
          <DrawerTitle className="text-center text-lg font-semibold">Total</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="flex items-center justify-between border-b border-border py-4">
            <span className="text-base text-foreground">Item price</span>
            <span className="text-base text-foreground">${itemPrice.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between border-b border-border py-4">
            <span className="text-base text-foreground">✈️ Shipping</span>
            <span className="text-base text-foreground">${shippingPrice.toFixed(2)}</span>
          </div>

          <div className="border-b border-border py-4">
            <div className="flex items-center justify-between">
              <span className="text-base text-foreground">Secure Checkout Fee</span>
              <span className="text-base text-foreground">${fees.secureCheckoutFee.toFixed(2)}</span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {fees.rateLabel}. This fee keeps Flea running and protects every order:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>- Buyer protection on every purchase</li>
              <li>- Secure payments and payouts</li>
              <li>- Fraud detection and prevention</li>
              <li>- Support when something goes wrong</li>
            </ul>
          </div>

          <div className="flex items-center justify-between py-4">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-base font-bold text-foreground">${fees.buyerTotal.toFixed(2)}</span>
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            Sellers pay no selling fees on Flea.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PriceBreakdownDrawer;

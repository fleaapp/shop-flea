import { useEffect, useMemo, useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MIN_LISTING_PRICE, calculateTransactionFee } from '@/utils/feeCalculator';
import { OFFER_MIN_PERCENT } from '@/hooks/useOffers';

interface MakeOfferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    title: string;
    price: number;
    shipping_price?: number | null;
    image?: string;
  };
  /** 'buyer' makes an offer, 'seller' sends a counter or discount. */
  mode?: 'buyer' | 'counter' | 'blast';
  /** Existing offer being countered. */
  parentOfferId?: string | null;
  onSubmit: (amount: number, parentOfferId?: string | null) => Promise<void>;
}

const QUICK_PICKS = [10, 15, 20];

const MakeOfferDrawer = ({
  open,
  onOpenChange,
  listing,
  mode = 'buyer',
  parentOfferId = null,
  onSubmit,
}: MakeOfferDrawerProps) => {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue('');
  }, [open, listing.id]);

  const price = Number(listing.price) || 0;
  const shipping = Number(listing.shipping_price || 0);
  const floor = useMemo(
    () => Math.max(MIN_LISTING_PRICE, Math.round(price * OFFER_MIN_PERCENT * 100) / 100),
    [price],
  );

  const amount = Number(value);
  const valid = Number.isFinite(amount) && amount >= floor && amount < price;
  const sellerNet = valid ? Math.max(0, amount + shipping - calculateTransactionFee(amount + shipping)) : 0;

  const heading =
    mode === 'counter' ? 'Send a counter-offer' : mode === 'blast' ? 'Offer to interested buyers' : 'Make an offer';

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(Math.round(amount * 100) / 100, parentOfferId);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Could not send your offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="fixed top-10 bottom-0 left-0 right-0 flex flex-col rounded-t-3xl">
        <DrawerHeader className="shrink-0 px-4 pb-2 pt-3">
          <DrawerTitle className="text-center text-lg font-semibold">{heading}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
            {listing.image && (
              <img
                src={listing.image}
                alt={listing.title}
                className="h-16 w-[52px] shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{listing.title}</p>
              <p className="text-sm text-muted-foreground">
                Asking ${price.toFixed(2)}
                {shipping > 0 && <span className="ml-1">✈️ +${shipping.toFixed(2)}</span>}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="text-sm font-medium text-foreground">Your offer</label>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={floor}
                max={price}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={floor.toFixed(2)}
                className="h-14 rounded-2xl pl-9 text-lg font-semibold"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Between ${floor.toFixed(2)} and ${(price - 0.01).toFixed(2)}. Shipping is added on top.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            {QUICK_PICKS.map((pct) => {
              const suggested = Math.max(floor, Math.round(price * (1 - pct / 100) * 100) / 100);
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setValue(suggested.toFixed(2))}
                  className="flex-1 rounded-xl border-2 border-border bg-card py-3 text-sm font-medium text-foreground active:bg-secondary"
                >
                  -{pct}%
                  <span className="block text-xs text-muted-foreground">${suggested.toFixed(2)}</span>
                </button>
              );
            })}
          </div>

          {valid && mode !== 'buyer' && (
            <div className="mt-4 rounded-2xl bg-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">You'd receive</span>
                <span className="font-semibold text-foreground">${sellerNet.toFixed(2)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                After the 2% + $0.50 transaction fee. No selling fees.
              </p>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === 'blast'
              ? 'Everyone with this item in their cart or wishlist gets 24 hours to take it.'
              : 'Offers expire after 24 hours. Items are not reserved until paid for.'}
          </p>
        </div>

        <div className="shrink-0 px-4 pb-8 pt-3">
          <Button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="h-14 w-full rounded-2xl text-base font-semibold"
          >
            {submitting ? 'Sending...' : mode === 'blast' ? 'Send to interested buyers' : 'Send offer'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MakeOfferDrawer;

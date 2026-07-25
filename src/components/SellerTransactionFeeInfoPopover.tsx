import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SellerTransactionFeeInfoPopover = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label="About the Transaction Fee"
        className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-muted transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-4 rounded-2xl z-[100]" side="top" align="center" onOpenAutoFocus={(e) => e.preventDefault()}>
      <p className="text-sm font-semibold mb-2">Transaction Fee</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        A small 2% + $0.50 fee per completed sale that covers payment processing. Listing on Flea is always free — this only applies when you make a sale, and is deducted from your payout.
      </p>
    </PopoverContent>
  </Popover>
);

export default SellerTransactionFeeInfoPopover;

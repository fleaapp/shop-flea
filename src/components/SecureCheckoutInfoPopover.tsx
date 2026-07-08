import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SecureCheckoutInfoPopover = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label="About the Secure Checkout Fee"
        className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-muted transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-4 rounded-2xl" side="top" align="center">
      <p className="text-sm font-semibold mb-2">Secure Checkout Fee</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        A small fee that helps us provide secure transactions, fraud prevention and marketplace support so you can shop with confidence. No hidden extras — Flea sellers pay no selling fees.
      </p>
    </PopoverContent>
  </Popover>
);

export default SecureCheckoutInfoPopover;

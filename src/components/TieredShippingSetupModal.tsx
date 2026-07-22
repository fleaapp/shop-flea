import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { saveShippingPrefs, BundleShippingMode } from '@/utils/shippingPrefs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TieredShippingSetupModalProps {
  open: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const DISCOUNT_OPTIONS = [10, 20, 30, 40, 50] as const;

const TieredShippingSetupModal = ({ open, onComplete, onCancel }: TieredShippingSetupModalProps) => {
  const { user, refreshProfile } = useAuth();
  const [mode, setMode] = useState<BundleShippingMode>('discounted');
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const updateData: Record<string, any> = {
        bundle_shipping_mode: mode,
        bundle_shipping_discount_percent: mode === 'discounted' ? discountPercent : null,
        shipping_preferences_set: true,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      saveShippingPrefs(user.id, {
        mode,
        discountPercent: mode === 'discounted' ? discountPercent : null,
      });

      if (error && (error as any).code !== 'PGRST204') {
        throw error;
      }

      await refreshProfile();
      toast.success('Shipping preferences saved!');
      onComplete();
    } catch (error) {
      console.error('Error saving shipping preferences:', error);
      toast.error('Failed to save shipping preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const OptionRow = ({
    value,
    title,
    subtitle,
  }: {
    value: BundleShippingMode;
    title: string;
    subtitle: string;
  }) => {
    const selected = mode === value;
    return (
      <button
        type="button"
        onClick={() => setMode(value)}
        className={cn(
          'w-full text-left rounded-2xl border p-3.5 transition-colors',
          selected
            ? 'border-charcoal bg-charcoal/5'
            : 'border-border bg-card hover:bg-secondary/40'
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0',
              selected ? 'border-charcoal' : 'border-muted-foreground/40'
            )}
          >
            {selected && <span className="h-2.5 w-2.5 rounded-full bg-charcoal" />}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        className="w-[90vw] max-w-md rounded-3xl border-[3px] border-charcoal bg-card p-6"
        hideCloseButton={false}
      >
        <DialogHeader className="text-center space-y-3 pt-4 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
            <span>✈️</span> Bundle Shipping
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-center leading-relaxed">
            Choose how you charge shipping<br />when buyers bundle items.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <OptionRow
            value="none"
            title="No bundle shipping"
            subtitle="Buyers pay each item's shipping in full."
          />
          <OptionRow
            value="discounted"
            title="Discounted for bundles"
            subtitle="Discount total shipping on bundles of 2+."
          />
          <OptionRow
            value="free"
            title="Free for bundles"
            subtitle="Bundles of 2+ items ship free."
          />

          {mode === 'discounted' && (
            <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
              <p className="text-sm font-medium text-foreground text-center">Discount amount</p>
              <div className="grid grid-cols-5 gap-2">
                {DISCOUNT_OPTIONS.map((pct) => {
                  const selected = discountPercent === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={cn(
                        'h-10 rounded-xl text-sm font-semibold border-2 transition-colors',
                        selected
                          ? 'border-charcoal bg-charcoal text-white'
                          : 'border-border bg-card text-foreground'
                      )}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center leading-relaxed pt-1">
            You can change this anytime<br />in Settings → Shipping.
          </p>

          <div className="flex justify-center pt-1">
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-40 h-12 rounded-full bg-charcoal text-white font-medium hover:bg-charcoal-light"
            >
              {isLoading ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TieredShippingSetupModal;

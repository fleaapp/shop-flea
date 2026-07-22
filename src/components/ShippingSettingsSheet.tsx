import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { loadShippingPrefs, saveShippingPrefs, BundleShippingMode } from '@/utils/shippingPrefs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShippingSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DISCOUNT_OPTIONS = [10, 20, 30, 40, 50] as const;

const ShippingSettingsSheet = ({ open, onOpenChange }: ShippingSettingsSheetProps) => {
  const { user, refreshProfile } = useAuth();
  const [mode, setMode] = useState<BundleShippingMode>('none');
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !open) return;

      setInitialLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('bundle_shipping_mode, bundle_shipping_discount_percent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        const local = loadShippingPrefs(user.id);
        if (local) {
          setMode(local.mode);
          if (local.mode === 'discounted' && local.discountPercent) {
            setDiscountPercent(local.discountPercent);
          }
        }
      } else {
        const m = (data.bundle_shipping_mode as BundleShippingMode) || 'none';
        setMode(m);
        if (m === 'discounted' && data.bundle_shipping_discount_percent) {
          setDiscountPercent(Number(data.bundle_shipping_discount_percent));
        }
      }

      setInitialLoading(false);
    };

    loadSettings();
  }, [user, open]);

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const updateData: Record<string, any> = {
        bundle_shipping_mode: mode,
        bundle_shipping_discount_percent: mode === 'discounted' ? discountPercent : null,
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
      toast.success('Shipping settings saved!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving shipping settings:', error);
      toast.error('Failed to save shipping settings');
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
          'w-full text-left rounded-2xl border p-4 transition-colors',
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-8">
        <DrawerHeader className="py-6">
          <DrawerTitle className="text-center flex items-center justify-center gap-2">
            <span>✈️</span> Bundle Shipping
          </DrawerTitle>
        </DrawerHeader>

        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-3xl">⏳</span>
          </div>
        ) : (
          <div className="space-y-3">
            <OptionRow
              value="none"
              title="No bundle shipping"
              subtitle="Buyers pay each item's shipping in full, even in bundles."
            />
            <OptionRow
              value="discounted"
              title="Discounted shipping for bundles"
              subtitle="Discount the total shipping when buyers buy 2+ items from you."
            />
            <OptionRow
              value="free"
              title="Free shipping for bundles"
              subtitle="Bundles of 2+ items ship free. Single items still pay shipping."
            />

            {mode === 'discounted' && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Discount amount</p>
                <div className="grid grid-cols-5 gap-2">
                  {DISCOUNT_OPTIONS.map((pct) => {
                    const selected = discountPercent === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        className={cn(
                          'h-11 rounded-xl text-sm font-semibold border-2 transition-colors',
                          selected
                            ? 'border-charcoal bg-charcoal text-white'
                            : 'border-border bg-background text-foreground hover:bg-secondary/40'
                        )}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Buyers save {discountPercent}% off their total shipping when they buy 2+ items
                  from you.
                </p>
              </div>
            )}

            <div className="flex justify-center pt-4">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="w-48 h-12 rounded-full bg-primary text-primary-foreground font-medium"
              >
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default ShippingSettingsSheet;

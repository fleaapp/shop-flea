import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { loadShippingPrefs, saveShippingPrefs, BundleShippingMode } from '@/utils/shippingPrefs';
import PercentSlider from '@/components/PercentSlider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShippingSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ShippingSettingsSheet = ({ open, onOpenChange }: ShippingSettingsSheetProps) => {
  const { user, refreshProfile } = useAuth();
  const [mode, setMode] = useState<BundleShippingMode>('none');
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [itemDiscountPercent, setItemDiscountPercent] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !open) return;

      setInitialLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('bundle_shipping_mode, bundle_shipping_discount_percent, bundle_item_discount_percent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        const local = loadShippingPrefs(user.id);
        if (local) {
          setMode(local.mode);
          if (local.mode === 'discounted' && local.discountPercent) {
            setDiscountPercent(local.discountPercent);
          }
          if (local.mode === 'item_discount' && local.itemDiscountPercent) {
            setItemDiscountPercent(local.itemDiscountPercent);
          }
        }
      } else {
        const m = (data.bundle_shipping_mode as BundleShippingMode) || 'none';
        setMode(m);
        if (m === 'discounted' && data.bundle_shipping_discount_percent) {
          setDiscountPercent(Number(data.bundle_shipping_discount_percent));
        }
        if (m === 'item_discount' && (data as any).bundle_item_discount_percent) {
          setItemDiscountPercent(Number((data as any).bundle_item_discount_percent));
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
        bundle_item_discount_percent: mode === 'item_discount' ? itemDiscountPercent : null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      saveShippingPrefs(user.id, {
        mode,
        discountPercent: mode === 'discounted' ? discountPercent : null,
        itemDiscountPercent: mode === 'item_discount' ? itemDiscountPercent : null,
      });

      if (error && (error as any).code !== 'PGRST204') {
        throw error;
      }

      await refreshProfile();
      toast.success('Bundle offers saved!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving bundle offers:', error);
      toast.error('Failed to save bundle offers');
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
            <span>📦</span> Bundle Offers
          </DrawerTitle>
        </DrawerHeader>

        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-3xl">⏳</span>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto">
            <OptionRow
              value="none"
              title="No bundle offers"
              subtitle="Buyers pay each item's price and shipping in full."
            />
            <OptionRow
              value="discounted"
              title="✈️ Discounted shipping for bundles"
              subtitle="Discount the total shipping when buyers buy 2+ items from you."
            />
            <OptionRow
              value="free"
              title="✈️ Free shipping for bundles"
              subtitle="Bundles of 2+ items ship free. Single items still pay shipping."
            />
            <OptionRow
              value="item_discount"
              title="📦 Discount on bundles"
              subtitle="Take a % off your item prices when buyers buy 2+ items. Shipping is charged as normal."
            />

            {mode === 'discounted' && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
                <p className="text-sm font-medium text-foreground text-center">
                  Shipping discount
                </p>
                <PercentSlider value={discountPercent} onChange={setDiscountPercent} />
                <p className="text-xs text-muted-foreground leading-snug text-center">
                  Buyers save {discountPercent}% off their total shipping when they buy 2+ items
                  from you.
                </p>
              </div>
            )}

            {mode === 'item_discount' && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
                <p className="text-sm font-medium text-foreground text-center">Bundle discount</p>
                <PercentSlider value={itemDiscountPercent} onChange={setItemDiscountPercent} />
                <p className="text-xs text-muted-foreground leading-snug text-center">
                  Buyers save {itemDiscountPercent}% off your item prices when they buy 2+ items
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

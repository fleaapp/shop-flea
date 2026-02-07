import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ShippingSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ShippingSettingsSheet = ({ open, onOpenChange }: ShippingSettingsSheetProps) => {
  const { user, refreshProfile } = useAuth();
  const [tieredEnabled, setTieredEnabled] = useState(true);
  const [tier1, setTier1] = useState('10.00');
  const [tier2, setTier2] = useState('13.00');
  const [tier3, setTier3] = useState('17.00');
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !open) return;
      
      setInitialLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setTieredEnabled(data.tiered_shipping_enabled ?? true);
        setTier1(data.shipping_tier_1?.toString() ?? '10.00');
        setTier2(data.shipping_tier_2?.toString() ?? '13.00');
        setTier3(data.shipping_tier_3?.toString() ?? '17.00');
      }
      setInitialLoading(false);
    };

    loadSettings();
  }, [user, open]);

  const handleSave = async () => {
    if (!user) return;

    // Validate inputs if tiered is enabled
    if (tieredEnabled) {
      const t1 = parseFloat(tier1);
      const t2 = parseFloat(tier2);
      const t3 = parseFloat(tier3);
      
      if (isNaN(t1) || t1 < 0) {
        toast.error('Please enter a valid base shipping price');
        return;
      }
      if (isNaN(t2) || t2 < 0) {
        toast.error('Please enter a valid 2-3 items shipping price');
        return;
      }
      if (isNaN(t3) || t3 < 0) {
        toast.error('Please enter a valid 4+ items shipping price');
        return;
      }
    }

    setIsLoading(true);
    try {
      const updateData: Record<string, any> = {
        tiered_shipping_enabled: tieredEnabled,
        shipping_preferences_set: true,
      };

      if (tieredEnabled) {
        updateData.shipping_tier_1 = parseFloat(tier1);
        updateData.shipping_tier_2 = parseFloat(tier2);
        updateData.shipping_tier_3 = parseFloat(tier3);
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-8">
        <DrawerHeader className="py-6">
          <DrawerTitle className="text-center flex items-center justify-center gap-2">
            <span>📦</span> Shipping Settings
          </DrawerTitle>
        </DrawerHeader>

        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-3xl">⏳</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-card p-4 border border-border">
              <Label htmlFor="tiered-toggle-settings" className="text-sm font-medium cursor-pointer">
                Tiered shipping
              </Label>
              <Switch 
                id="tiered-toggle-settings"
                checked={tieredEnabled} 
                onCheckedChange={setTieredEnabled}
                className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-muted"
              />
            </div>

            {/* Tier inputs - only show if enabled */}
            {tieredEnabled && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Shipping tiers</p>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm w-24">1 item:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tier1}
                      onChange={(e) => setTier1(e.target.value)}
                      className="pl-7 h-11 rounded-xl"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm w-24">2–3 items:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tier2}
                      onChange={(e) => setTier2(e.target.value)}
                      className="pl-7 h-11 rounded-xl"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm w-24">4+ items:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tier3}
                      onChange={(e) => setTier3(e.target.value)}
                      className="pl-7 h-11 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {!tieredEnabled && (
              <div className="rounded-xl bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Tiered shipping is disabled.<br />
                  Shipping for each listing will be charged individually.
                </p>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-center pt-2">
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

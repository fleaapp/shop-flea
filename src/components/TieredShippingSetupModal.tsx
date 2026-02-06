import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface TieredShippingSetupModalProps {
  open: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const TieredShippingSetupModal = ({ open, onComplete, onCancel }: TieredShippingSetupModalProps) => {
  const { user, refreshProfile } = useAuth();
  const [tieredEnabled, setTieredEnabled] = useState(true);
  const [tier1, setTier1] = useState('10.00');
  const [tier2, setTier2] = useState('13.00');
  const [tier3, setTier3] = useState('17.00');
  const [isLoading, setIsLoading] = useState(false);

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
      toast.success('Shipping preferences saved!');
      onComplete();
    } catch (error) {
      console.error('Error saving shipping preferences:', error);
      toast.error('Failed to save shipping preferences');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent 
        className="w-[90vw] max-w-md rounded-3xl border-[3px] border-charcoal bg-card p-6"
        hideCloseButton={false}
      >
        <DialogHeader className="text-center space-y-3 pt-4 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
            <span>📦</span> Set Your Shipping
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-center leading-relaxed">
            Before you list your first item,<br />set your shipping preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-xl bg-card p-4 border border-border">
            <Label htmlFor="tiered-toggle" className="text-sm font-medium cursor-pointer">
              {tieredEnabled ? 'Tiered shipping (recommended)' : 'Tiered shipping OFF'}
            </Label>
            <Switch 
              id="tiered-toggle"
              checked={tieredEnabled} 
              onCheckedChange={setTieredEnabled} 
            />
          </div>

          {/* Tier inputs - only show if enabled */}
          {tieredEnabled && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Buyers pay less when they buy<br />multiple items from you.
              </p>
              
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium flex-1">1 item</span>
                <div className="relative w-24">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tier1}
                    onChange={(e) => setTier1(e.target.value)}
                    className="pl-7 h-11 rounded-xl"
                    placeholder="10.00"
                  />
                </div>
                <span className="text-xs text-muted-foreground w-24">Base shipping</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium flex-1">2–3 items</span>
                <div className="relative w-24">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tier2}
                    onChange={(e) => setTier2(e.target.value)}
                    className="pl-7 h-11 rounded-xl"
                    placeholder="13.00"
                  />
                </div>
                <span className="text-xs text-muted-foreground w-24">Slightly higher</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium flex-1">4+ items</span>
                <div className="relative w-24">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tier3}
                    onChange={(e) => setTier3(e.target.value)}
                    className="pl-7 h-11 rounded-xl"
                    placeholder="17.00"
                  />
                </div>
                <span className="text-xs text-muted-foreground w-24">Discounted rate</span>
              </div>
            </div>
          )}

          {!tieredEnabled && (
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Each listing charges exactly what you enter —<br />no combined shipping, no discounts.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            You can always adjust shipping per listing<br />or in Settings → Shipping.
          </p>

          {/* CTA Button */}
          <div className="flex justify-center">
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

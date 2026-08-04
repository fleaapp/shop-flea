import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { useQueryClient } from '@tanstack/react-query';

const REASONS = [
  'Item no longer available',
  'Item damaged or flawed',
  'Sold elsewhere',
  'Wrong price or listing details',
  'Other',
] as const;

interface CancelItemDialogProps {
  orderId: string | null;
  itemTitle?: string;
  itemImage?: string;
  itemPrice?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void;
}

const CancelItemDialog = ({ orderId, itemTitle, itemImage, itemPrice, open, onOpenChange, onCancelled }: CancelItemDialogProps) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [relist, setRelist] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason('');
    setDetails('');
    setRelist(true);
  };


  const handleConfirm = async () => {
    if (!orderId) return;
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!finalReason) {
      toast.error('Please add a short reason.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: beginError } = await supabase.rpc('seller_cancel_order_begin', {
        p_order_id: orderId,
        p_reason: finalReason,
      });
      if (beginError) throw new Error(beginError.message);

      const res: any = await invokeCloudFunction('stripe-connect-refund', {
        orderId,
        mode: 'single',
        sellerCancelled: true,
        reason: 'requested_by_customer',
      });
      if (res?.error || !res?.data?.success) {
        throw new Error(res?.error?.message || res?.data?.error || 'Refund failed');
      }

      if (relist) {
        const { error: relistError } = await supabase.rpc('seller_relist_cancelled_listing', {
          p_order_id: orderId,
        });
        if (relistError) {
          toast.warning('Item cancelled and refunded, but it could not be relisted automatically.');
        }
      }

      toast.success(
        relist
          ? 'Item cancelled and refunded. It is back up for sale.'
          : 'Item cancelled and refunded. The buyer has been notified.',
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['listings'] }),
        queryClient.invalidateQueries({ queryKey: ['seller-balance'] }),
      ]);

      reset();
      onOpenChange(false);
      onCancelled?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not cancel this item. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <AlertDialogContent className="max-w-[340px] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {itemTitle ? `"${itemTitle}"` : 'this item'}?</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Why are you cancelling?</p>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r}
                  htmlFor={`cancel-reason-${r}`}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                    reason === r ? 'border-charcoal bg-muted' : 'border-border bg-card'
                  }`}
                >
                  <RadioGroupItem
                    value={r}
                    id={`cancel-reason-${r}`}
                    className="border-charcoal text-charcoal"
                  />
                  <Label htmlFor={`cancel-reason-${r}`} className="text-sm font-normal text-foreground cursor-pointer">
                    {r}
                  </Label>
                </label>
              ))}
            </RadioGroup>
            {reason === 'Other' && (
              <Input
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Tell the buyer what happened"
                maxLength={200}
                className="h-9 rounded-lg"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Relist this item</p>
              <p className="text-xs text-muted-foreground">Put it back up for sale on your profile.</p>
            </div>
            <Switch checked={relist} onCheckedChange={setRelist} />
          </div>

          <p className="text-xs text-muted-foreground">
            The buyer gets a full refund, including their fees, and you are not paid for this item. Cancelling often can affect your account.
          </p>
        </div>

        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel disabled={submitting} className="flex-1 h-9 rounded-lg mt-0">
            Keep item
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className="flex-1 h-9 rounded-lg bg-charcoal text-white hover:bg-charcoal-light"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel item'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancelItemDialog;

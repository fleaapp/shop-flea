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

export interface CancelItemTarget {
  id: string;
  title?: string;
  image?: string;
  price?: number;
}

interface CancelItemDialogProps {
  orderId: string | null;
  itemTitle?: string;
  itemImage?: string;
  itemPrice?: number;
  /** When provided, refunds every listed item in sequence. */
  items?: CancelItemTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void;
}

const CancelItemDialog = ({ orderId, itemTitle, itemImage, itemPrice, items, open, onOpenChange, onCancelled }: CancelItemDialogProps) => {
  const targets: CancelItemTarget[] = items?.length
    ? items
    : orderId
      ? [{ id: orderId, title: itemTitle, image: itemImage, price: itemPrice }]
      : [];
  const multiple = targets.length > 1;
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
    if (!targets.length) return;
    const finalReason = [reason, details.trim()].filter(Boolean).join(' - ');
    if (!reason) {
      toast.error('Please choose a reason.');
      return;
    }

    setSubmitting(true);
    try {
      let relistFailed = false;
      for (const target of targets) {
        const { error: beginError } = await supabase.rpc('seller_cancel_order_begin', {
          p_order_id: target.id,
          p_reason: finalReason,
        });
        if (beginError) throw new Error(beginError.message);

        const res: any = await invokeCloudFunction('stripe-connect-refund', {
          orderId: target.id,
          mode: 'single',
          sellerCancelled: true,
          reason: 'requested_by_customer',
        });
        if (res?.error || !res?.data?.success) {
          throw new Error(res?.error?.message || res?.data?.error || 'Refund failed');
        }

        if (relist) {
          const { error: relistError } = await supabase.rpc('seller_relist_cancelled_listing', {
            p_order_id: target.id,
          });
          if (relistError) relistFailed = true;
        }
      }

      if (relistFailed) {
        toast.warning(multiple ? 'Items refunded, but some could not be relisted automatically.' : 'Item refunded, but it could not be relisted automatically.');
      } else {
        toast.success(
          relist
            ? multiple ? 'Items refunded. They are back up for sale.' : 'Item refunded. It is back up for sale.'
            : multiple ? 'Items refunded. The buyer has been notified.' : 'Item refunded. The buyer has been notified.'
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['listings'] }),
        queryClient.invalidateQueries({ queryKey: ['seller-balance'] }),
      ]);

      reset();
      onOpenChange(false);
      onCancelled?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not refund. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-[85vw] sm:max-w-sm rounded-2xl z-[110] max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{multiple ? `Refund ${targets.length} items` : 'Refund item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-xl bg-card border border-border p-3">
            <div className="space-y-2">
              {targets.map((t) => (
                <div key={t.id} className="flex gap-3 items-center">
                  {t.image && (
                    <img
                      src={t.image}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{t.title || 'Item'}</p>
                    {typeof t.price === 'number' && (
                      <p className="text-xs text-muted-foreground mt-0.5">${t.price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-medium text-foreground block">Reason for refund *</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200] pointer-events-auto">
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Additional details</label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Let the buyer know what happened..."
              className="rounded-xl resize-none"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">{multiple ? 'Relist these items' : 'Relist this item'}</p>
              <p className="text-xs text-muted-foreground">{multiple ? 'Put them back up for sale on your profile.' : 'Put it back up for sale on your profile.'}</p>
            </div>
            <Switch checked={relist} onCheckedChange={setRelist} />
          </div>

          <p className="text-xs text-muted-foreground leading-snug">
            The buyer gets a full refund, including their fees, and you are not paid for {multiple ? 'these items' : 'this item'}. Refunding often can affect your account.
          </p>

          <Button
            onClick={handleConfirm}
            disabled={submitting || !reason || !targets.length}
            className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : multiple ? `Refund ${targets.length} items` : 'Refund item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

  );
};

export default CancelItemDialog;

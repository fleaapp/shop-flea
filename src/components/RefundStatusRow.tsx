import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AU_CARRIERS, normaliseTrackingNumber, validateTrackingFormat } from '@/lib/auCarriers';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { openTrackingUrl } from '@/lib/tracking';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Order } from '@/hooks/useOrders';

/**
 * Shows where a refund request currently sits for either party, and lets the
 * buyer add return tracking when a return has been requested.
 *
 * Money never moves from this component: the refund fires automatically once
 * the return parcel is scanned as delivered back to the seller.
 */
export type RefundStatusRole = 'buyer' | 'seller';

const fmt = (iso?: string | null) => (iso ? format(new Date(iso), 'MMM d') : '');

export function RefundStatusRow({
  order,
  role,
  onUpdated,
}: {
  order: Order;
  role: RefundStatusRole;
  onUpdated?: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useMemo(() => {
    if (order.refunded_at || order.status === 'refunded') {
      return { key: 'refunded' as const, title: '💸 Refunded', body: 'This item has been refunded.' };
    }
    if (order.return_delivered_at) {
      return {
        key: 'return_delivered' as const,
        title: '📦 Return delivered',
        body: 'The return arrived back with the seller. The refund is being issued.',
      };
    }
    if (order.return_required_at && order.return_tracking_number) {
      return {
        key: 'return_in_transit' as const,
        title: '✈️ Return in transit',
        body:
          role === 'buyer'
            ? 'Your refund is issued automatically once the seller receives the item.'
            : 'The buyer is refunded automatically once this arrives back with you.',
      };
    }
    if (order.return_required_at) {
      return {
        key: 'return_required' as const,
        title: '↩️ Return required',
        body:
          role === 'buyer'
            ? `Post the item back with tracked postage and add the tracking number by ${fmt(order.return_deadline_at)}. If you do not, the request closes and the seller keeps the payment.`
            : `The buyer has until ${fmt(order.return_deadline_at)} to post the item back.`,
      };
    }
    if (order.refund_escalated_at) {
      return {
        key: 'under_review' as const,
        title: '⚖️ Under Flea review',
        body: 'No response within 14 days, so Flea is now reviewing this request.',
      };
    }
    if (order.refund_declined_at) {
      return {
        key: 'declined' as const,
        title: '⚖️ Under Flea review',
        body: order.refund_declined_reason
          ? `The refund was declined - "${order.refund_declined_reason}". Flea is reviewing it.`
          : 'The refund was declined. Flea is reviewing it.',
      };
    }
    if (order.refund_requested_at) {
      return {
        key: 'awaiting' as const,
        title: '⏳ Awaiting seller response',
        body:
          role === 'buyer'
            ? `The seller has until ${fmt(order.refund_request_deadline_at)} to respond. After that Flea steps in.`
            : `Respond by ${fmt(order.refund_request_deadline_at)}, or Flea will review this request.`,
      };
    }
    return null;
  }, [order, role]);

  if (!state) return null;

  const canAddTracking = role === 'buyer' && state.key === 'return_required';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <p className="text-sm font-semibold text-foreground">{state.title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{state.body}</p>

      {order.return_tracking_number && (
        <button
          type="button"
          onClick={() =>
            openTrackingUrl(order.return_tracking_provider, order.return_tracking_number!)
          }
          className="text-xs underline text-foreground"
        >
          {order.return_tracking_provider} - {order.return_tracking_number}
        </button>
      )}

      {canAddTracking && (
        <Button
          className="w-full rounded-full h-10 bg-charcoal text-white hover:bg-charcoal-light mt-1"
          onClick={() => setSheetOpen(true)}
        >
          Add return tracking
        </Button>
      )}

      <ReturnTrackingDialog
        orderId={order.id}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => {
          setSheetOpen(false);
          onUpdated?.();
        }}
      />
    </div>
  );
}

function ReturnTrackingDialog({
  orderId,
  open,
  onOpenChange,
  onSaved,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [carrier, setCarrier] = useState('');
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const formatError = validateTrackingFormat(carrier, number);
    if (formatError) return toast.error(formatError);
    setSaving(true);
    try {
      const { data, error } = await invokeCloudFunction('return-register', {
        body: {
          order_id: orderId,
          carrier,
          tracking_number: normaliseTrackingNumber(number),
        },
      });
      const errMessage =
        (error && (typeof error === 'string' ? error : error.message)) ||
        (data && typeof data === 'object' && 'error' in data ? (data as any).error : null);
      if (errMessage) throw new Error(errMessage);
      toast.success('✈️ Return tracking added.');
      setCarrier('');
      setNumber('');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save return tracking. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-[340px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Add return tracking</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Post the item back with a tracked service, then add the tracking here. Your refund is
          issued automatically when it is delivered to the seller.
        </p>
        <div className="relative">
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className={cn(
              'h-11 w-full appearance-none rounded-xl border border-border bg-background pl-3 pr-9 text-sm',
              carrier ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <option value="" disabled>
              Select carrier
            </option>
            {AU_CARRIERS.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Tracking number"
          className="h-11 rounded-xl"
          autoCapitalize="characters"
        />
        <Button
          className="w-full rounded-full h-11 bg-charcoal text-white hover:bg-charcoal-light"
          disabled={saving || !carrier || !number.trim()}
          onClick={submit}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save tracking'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default RefundStatusRow;

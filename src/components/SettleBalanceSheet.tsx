import { useEffect, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getStripe } from '@/lib/stripe/loadStripe';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';

interface BreakdownRow {
  id: string;
  type: string;
  amountCents: number;
  createdAt: string;
  description: string | null;
}

interface SettleBalanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountCents: number;
  onSettled: () => void;
}

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format((cents || 0) / 100);

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

function PayForm({ amountCents, onDone }: { amountCents: number; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      });
      if (error) throw new Error(error.message || 'Payment failed');
      toast.success('✅ Balance settled. Buying, listing and payouts are unlocked.');
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Payment failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <Button
        onClick={handleSubmit}
        disabled={!stripe || busy}
        className="w-full h-12 rounded-xl bg-charcoal text-white hover:bg-charcoal/90 font-semibold"
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing...
          </span>
        ) : (
          <>Pay {fmtMoney(amountCents)}</>
        )}
      </Button>
    </div>
  );
}

export function SettleBalanceSheet({ open, onOpenChange, amountCents, onSettled }: SettleBalanceSheetProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || amountCents <= 0) return;
    setClientSecret(null);
    setBreakdown([]);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const { data, error: err } = await invokeCloudFunction('stripe-connect-topup', { amountCents });
        if (err) throw new Error(err.message || 'Could not start payment');
        if ((data as any)?.error) throw new Error((data as any).error);
        setClientSecret((data as any).clientSecret);
        setConnectedAccountId((data as any).connectedAccountId);
        setBreakdown(Array.isArray((data as any).breakdown) ? (data as any).breakdown : []);
      } catch (e: any) {
        setError(e?.message || 'Could not start payment');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, amountCents]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90svh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settle your balance</SheetTitle>
        </SheetHeader>
        <div className="mt-2 mb-3 text-[13px] text-muted-foreground">
          You have an outstanding balance of <span className="font-semibold text-foreground">{fmtMoney(amountCents)}</span> from
          refunds or disputes. Pay it now to unlock buying, listing, and payouts.
        </div>

        {breakdown.length > 0 && (
          <div className="mb-4 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
              What you owe on
            </div>
            <ul className="divide-y divide-border">
              {breakdown.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 pr-3">
                    <div className="text-[13px] font-medium text-foreground truncate">
                      {b.description || b.type}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(b.createdAt)}</div>
                  </div>
                  <div className="text-[13px] font-semibold text-destructive whitespace-nowrap">
                    -{fmtMoney(b.amountCents)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <div className="text-sm text-destructive py-4">{error}</div>}
        {!loading && !error && clientSecret && connectedAccountId && (
          <Elements
            stripe={getStripe()}
            options={{
              clientSecret,
              // @ts-ignore stripeAccount supported at runtime
              stripeAccount: connectedAccountId,
              appearance: { theme: 'stripe' },
            }}
          >
            <PayForm
              amountCents={amountCents}
              onDone={() => {
                onOpenChange(false);
                onSettled();
              }}
            />
          </Elements>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default SettleBalanceSheet;


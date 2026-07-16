import { useEffect, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getStripe } from '@/lib/stripe/loadStripe';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';

interface SettleBalanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountCents: number;
  onSettled: () => void;
}

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format((cents || 0) / 100);

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
      toast.success('Balance settled. Thanks!');
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || amountCents <= 0) return;
    setClientSecret(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const { data, error: err } = await invokeCloudFunction('stripe-connect-topup', { amountCents });
        if (err) throw new Error(err.message || 'Could not start payment');
        if ((data as any)?.error) throw new Error((data as any).error);
        setClientSecret((data as any).clientSecret);
        setConnectedAccountId((data as any).connectedAccountId);
      } catch (e: any) {
        setError(e?.message || 'Could not start payment');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, amountCents]);

  const stripePromise = connectedAccountId
    ? getStripe().then((s) => s) // load once, but Elements needs stripeAccount option
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90svh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settle your balance</SheetTitle>
        </SheetHeader>
        <div className="mt-2 mb-4 text-[13px] text-muted-foreground">
          You have an outstanding balance of <span className="font-semibold text-foreground">{fmtMoney(amountCents)}</span> from
          refunds or disputes. Pay it now to unlock buying, selling, and payouts.
        </div>
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
              // Payment Intent was created on the connected account, so Elements
              // must talk to Stripe as that account.
              // @ts-ignore stripeAccount is supported at runtime
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

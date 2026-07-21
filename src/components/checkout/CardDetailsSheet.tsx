import { useEffect, useState } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock } from 'lucide-react';
import {
  Elements,
  useElements,
  useStripe,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from '@stripe/react-stripe-js';
import type { StripeElementStyle } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe/loadStripe';
import { toast } from 'sonner';

// Non-sensitive cardholder-name persistence so backgrounding the app while
// looking up card details doesn't wipe it. Card number / expiry / CVC are
// held in Stripe's iframes and are intentionally NEVER persisted (PCI rule).
const CARDHOLDER_DRAFT_KEY = 'flea_draft_card_cardholder_v1';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (args: {
    paymentMethodId: string;
    cardholderName: string;
    saveCard: boolean;
  }) => Promise<void>;
  /** Buyer's shipping postcode — sent as billing_details.address for AVS. */
  billingPostcode?: string;
}

const elementStyle: StripeElementStyle = {
  base: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a1a1a',
    iconColor: '#1a1a1a',
    '::placeholder': { color: '#b0b0b0', fontWeight: '400' },
    fontSmoothing: 'antialiased',
  },
  invalid: { color: '#dc2626', iconColor: '#dc2626' },
};

const Field = ({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-xl border border-border bg-background px-3.5 py-2.5 ${className}`}
  >
    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block mb-1">
      {label}
    </label>
    <div className="min-h-[22px] flex items-center">{children}</div>
  </div>
);

const CardForm = ({
  onConfirm,
  billingPostcode,
}: {
  onConfirm: Props['onConfirm'];
  billingPostcode?: string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(CARDHOLDER_DRAFT_KEY) || ''; } catch { return ''; }
  });
  const [saveCard, setSaveCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Persist cardholder name (non-sensitive) on every change and again on
  // background/unload — the WebView may be evicted the moment we hide.
  useEffect(() => {
    const write = () => {
      try {
        if (name) localStorage.setItem(CARDHOLDER_DRAFT_KEY, name);
        else localStorage.removeItem(CARDHOLDER_DRAFT_KEY);
      } catch { /* noop */ }
    };
    const t = window.setTimeout(write, 250);
    const onVis = () => { if (document.visibilityState === 'hidden') write(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', write);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', write);
    };
  }, [name]);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) return;
    if (!name.trim()) {
      toast.error("Please enter the cardholder's name.");
      return;
    }
    setSubmitting(true);
    try {
      const postal = (billingPostcode || '').trim();
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumber,
        billing_details: {
          name: name.trim(),
          address: {
            country: 'AU',
            ...(postal ? { postal_code: postal } : {}),
          },
        },
      });
      if (error || !paymentMethod) {
        toast.error(error?.message || 'Could not read card. Please check the details.');
        return;
      }
      await onConfirm({
        paymentMethodId: paymentMethod.id,
        cardholderName: name.trim(),
        saveCard,
      });
      try { localStorage.removeItem(CARDHOLDER_DRAFT_KEY); } catch { /* noop */ }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="px-4 pt-3 pb-8 space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Card details</h2>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Lock size={13} />
          <span>Your card is securely encrypted</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <Field label="Cardholder's name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name on card"
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-[22px] text-base font-medium bg-transparent"
          />
        </Field>

        <Field label="Card number">
          <div className="w-full">
            <CardNumberElement
              options={{
                style: elementStyle,
                showIcon: true,
                placeholder: '1234 1234 1234 1234',
              }}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Expiry date">
            <div className="w-full">
              <CardExpiryElement
                options={{ style: elementStyle, placeholder: 'MM / YY' }}
              />
            </div>
          </Field>
          <Field label="Security code">
            <div className="w-full">
              <CardCvcElement options={{ style: elementStyle, placeholder: 'CVC' }} />
            </div>
          </Field>
        </div>
      </div>

      <label className="flex items-start gap-3 pt-1">
        <Checkbox
          checked={saveCard}
          onCheckedChange={(v) => setSaveCard(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-muted-foreground leading-snug">
          Save these card details for faster checkout. You can remove the card
          anytime in Settings, under Payments.
        </span>
      </label>

      <Button
        onClick={handleSubmit}
        disabled={!stripe || submitting}
        className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light font-medium"
      >
        {submitting ? 'Processing...' : 'Use this card'}
      </Button>
    </div>
  );
};

const CardDetailsSheet = ({ open, onClose, onConfirm, billingPostcode }: Props) => {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="bg-background">
        <div className="flex items-center justify-end px-4 pt-3 pb-1">
          <button onClick={onClose} className="text-sm text-foreground">
            Close
          </button>
        </div>
        <Elements stripe={getStripe()} options={{ locale: 'en' }}>
          <CardForm onConfirm={onConfirm} billingPostcode={billingPostcode} />
        </Elements>
      </DrawerContent>
    </Drawer>
  );
};

export default CardDetailsSheet;

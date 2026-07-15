import { useState } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock } from 'lucide-react';
import { Elements, useElements, useStripe, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import type { StripeElementStyle } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe/loadStripe';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (args: { paymentMethodId: string; cardholderName: string; saveCard: boolean }) => Promise<void>;
}

const elementStyle: StripeElementStyle = {
  base: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '16px',
    color: '#1a1a1a',
    '::placeholder': { color: '#b0b0b0' },
    fontSmoothing: 'antialiased',
  },
  invalid: { color: '#dc2626' },
};

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="border-b border-border/70 py-3">
    <label className="text-xs text-muted-foreground block mb-1.5">{label}</label>
    {children}
  </div>
);

const CardForm = ({ onConfirm, onClose }: { onConfirm: Props['onConfirm']; onClose: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState('');
  const [saveCard, setSaveCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumber,
        billing_details: { name: name.trim() },
      });
      if (error || !paymentMethod) {
        toast.error(error?.message || 'Could not read card. Please check the details.');
        return;
      }
      await onConfirm({ paymentMethodId: paymentMethod.id, cardholderName: name.trim(), saveCard });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-2 pb-8 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Card details</h2>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Your card is securely encrypted</span>
          <Lock size={13} />
        </div>
      </div>

      <div className="rounded-2xl border border-border p-4 space-y-1">
        <FieldRow label="Cardholder's name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name on card"
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-8 text-base"
          />
        </FieldRow>
        <FieldRow label="Card number">
          <div className="h-8 flex items-center">
            <CardNumberElement options={{ style: elementStyle, showIcon: true, placeholder: '1234 1234 1234 1234' }} />
          </div>
        </FieldRow>
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Expiry date">
            <div className="h-8 flex items-center">
              <CardExpiryElement options={{ style: elementStyle, placeholder: 'MM / YY' }} />
            </div>
          </FieldRow>
          <FieldRow label="Security code">
            <div className="h-8 flex items-center">
              <CardCvcElement options={{ style: elementStyle, placeholder: 'CVC' }} />
            </div>
          </FieldRow>
        </div>
      </div>

      <label className="flex items-start gap-3 pt-1">
        <Checkbox
          checked={saveCard}
          onCheckedChange={(v) => setSaveCard(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-muted-foreground leading-snug">
          Agree to save these card details for faster checkout. You can remove the card anytime in Settings, under Payments.
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

const CardDetailsSheet = ({ open, onClose, onConfirm }: Props) => {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="bg-background">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/60">
          <button onClick={onClose} className="text-sm text-foreground">Close</button>
          <h1 className="text-base font-semibold text-foreground">Card details</h1>
          <div className="w-10" />
        </div>
        <Elements stripe={getStripe()} options={{ locale: 'en' }}>
          <CardForm onConfirm={onConfirm} onClose={onClose} />
        </Elements>
      </DrawerContent>
    </Drawer>
  );
};

export default CardDetailsSheet;

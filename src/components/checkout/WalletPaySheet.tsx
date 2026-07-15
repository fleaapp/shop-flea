// Small drawer that mounts Stripe's ExpressCheckoutElement to trigger the
// native Apple Pay / Google Pay sheet using the already-created PaymentIntent.
import { useEffect, useState } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Elements, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe/loadStripe';
import { fleaAppearance } from '@/lib/stripe/appearance';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  clientSecret: string;
  amountCents: number;
  onSuccess: (paymentIntentId: string) => void;
}

const WalletInner = ({ clientSecret, onSuccess, onClose }: Omit<Props, 'open' | 'amountCents'>) => {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements || confirming) return;
    setConfirming(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: `${window.location.origin}/checkout/success` },
      redirect: 'if_required',
    });
    if (error) {
      toast.error(error.message || 'Payment was not completed.');
      setConfirming(false);
      return;
    }
    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
      onSuccess(paymentIntent.id);
    } else {
      toast.error('Payment did not complete. Please try again.');
    }
    setConfirming(false);
  };

  return (
    <div className="px-4 pt-2 pb-8 space-y-4">
      <h2 className="text-xl font-bold text-foreground">Confirm payment</h2>
      <ExpressCheckoutElement
        onConfirm={handleConfirm}
        options={{ buttonHeight: 50, buttonTheme: { applePay: 'black', googlePay: 'black' } }}
      />
      <button
        onClick={onClose}
        className="w-full text-center text-sm text-muted-foreground py-2"
      >
        Cancel
      </button>
    </div>
  );
};

const WalletPaySheet = ({ open, onClose, clientSecret, amountCents, onSuccess }: Props) => {
  const [ready, setReady] = useState(false);
  useEffect(() => { if (open) setReady(true); }, [open]);
  if (!ready) return null;
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="bg-background">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/60">
          <button onClick={onClose} className="text-sm text-foreground">Close</button>
          <h1 className="text-base font-semibold text-foreground">Wallet</h1>
          <div className="w-10" />
        </div>
        <Elements
          stripe={getStripe()}
          options={{
            mode: 'payment',
            amount: amountCents,
            currency: 'aud',
            appearance: fleaAppearance,
            paymentMethodCreation: 'manual',
          }}
        >
          <WalletInner clientSecret={clientSecret} onSuccess={onSuccess} onClose={onClose} />
        </Elements>
      </DrawerContent>
    </Drawer>
  );
};

export default WalletPaySheet;

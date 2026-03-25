import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import stripeLogo from '@/assets/logo-stripe.png';
import paypalLogo from '@/assets/logo-paypal.png';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import StripeOnboardingSheet from '@/components/StripeOnboardingSheet';

interface ConnectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ConnectPaymentDialog = ({ open, onOpenChange }: ConnectPaymentDialogProps) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isConnectingPayPal, setIsConnectingPayPal] = useState(false);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);

  const handleConnectStripe = () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }
    setShowStripeOnboarding(true);
  };

  const handleConnectPayPal = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect PayPal');
      return;
    }

    setIsConnectingPayPal(true);
    try {
      const { data, error } = await invokeCloudFunction('paypal-connect-onboard', {
        returnUrl: window.location.origin + '/settings',
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      localStorage.setItem('flea_paypal_pending', 'true');
      window.location.href = data.url;
    } catch (error: any) {
      console.error('PayPal Connect error:', error);
      toast.error('Failed to start PayPal connection. Please try again.');
    } finally {
      setIsConnectingPayPal(false);
    }
  };

  return (
    <>
    <Dialog open={open && !showStripeOnboarding} onOpenChange={() => {}}>
      <DialogContent hideCloseButton className="w-[88vw] max-w-sm rounded-3xl border-[3px] border-charcoal bg-card p-6 pt-10 pb-8" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-center text-lg">
            💳 Connect a Payment Method
          </DialogTitle>
          <DialogDescription className="text-center text-balance max-w-[260px] mx-auto">
            To sell on Flea, connect Stripe or PayPal to receive payments directly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4 flex flex-col items-center">
          <Button
            onClick={handleConnectStripe}
            disabled={isConnectingPayPal}
            className="w-56 h-14 rounded-full bg-muted text-foreground hover:bg-muted/80 border-none shadow-none ring-0 outline-none focus-visible:ring-0 flex items-center justify-center gap-2.5 text-[15px] font-medium"
          >
            <><img src={stripeLogo} alt="Stripe" className="h-6 w-auto object-contain rounded" /> Connect Stripe</>
          </Button>
          <Button
            onClick={handleConnectPayPal}
            disabled={isConnectingPayPal}
            className="w-56 h-14 rounded-full bg-muted text-foreground hover:bg-muted/80 border-none shadow-none ring-0 outline-none focus-visible:ring-0 flex items-center justify-center gap-2.5 text-[15px] font-medium"
          >
            {isConnectingPayPal ? 'Connecting...' : <><img src={paypalLogo} alt="PayPal" className="h-5 w-auto object-contain" /> Connect PayPal</>}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              navigate(-1);
            }}
            className="w-64 h-10 text-muted-foreground mt-1 shadow-none ring-0 outline-none focus-visible:ring-0 border-none"
          >
            Go Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <StripeOnboardingSheet
      open={showStripeOnboarding}
      onOpenChange={(v) => {
        setShowStripeOnboarding(v);
        if (!v) onOpenChange(false);
      }}
      onComplete={() => {
        setShowStripeOnboarding(false);
        onOpenChange(false);
      }}
    />
    </>
  );
};

export default ConnectPaymentDialog;

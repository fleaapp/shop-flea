import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import stripeLogo from '@/assets/logo-stripe.png';
import paypalLogo from '@/assets/logo-paypal.png';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import StripeOnboardingSheet from '@/components/StripeOnboardingSheet';
import { getStripeConnectedStorageKey } from '@/utils/stripeConnectionState';

interface ConnectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stripeActionRequired?: boolean;
}

const ConnectPaymentDialog = ({ open, onOpenChange, stripeActionRequired = false }: ConnectPaymentDialogProps) => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [isConnectingPayPal, setIsConnectingPayPal] = useState(false);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Determine PayPal action required (has merchant ID but not complete)
  const paypalActionRequired = !!(profile as any)?.paypal_merchant_id && !(profile as any)?.paypal_onboarding_complete;

  const hasActionRequired = stripeActionRequired || paypalActionRequired;

  const handleConnectStripe = () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }
    if (stripeActionRequired) {
      // Open Stripe dashboard to resolve action required
      window.open('https://dashboard.stripe.com', '_blank');
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

  // Re-check status after returning from Stripe onboarding
  const handleStripeOnboardingComplete = useCallback(async () => {
    setShowStripeOnboarding(false);
    if (!user) return;
    setIsVerifying(true);
    try {
      const { data, error } = await invokeCloudFunction('stripe-connect-status', {
        stripeAccountId: profile?.stripe_account_id || undefined,
      });
      if (error) throw error;

      if (data?.chargesEnabled && data?.payoutsEnabled) {
        const key = getStripeConnectedStorageKey(user.id);
        localStorage.setItem(key, 'true');
        await refreshProfile();
        onOpenChange(false);
        toast.success('Stripe connected! You can now create listings.');
      } else {
        toast('Stripe verification still in progress. Please complete any required steps in the Stripe dashboard.');
      }
    } catch (e) {
      console.error('Post-onboarding verification failed:', e);
    } finally {
      setIsVerifying(false);
    }
  }, [user, profile?.stripe_account_id, refreshProfile, onOpenChange]);

  const description = hasActionRequired
    ? 'Your payment account needs attention. Complete verification to start selling.'
    : 'To sell on Flea, connect Stripe or PayPal to receive payments directly.';

  return (
    <>
    <Dialog open={open && !showStripeOnboarding} onOpenChange={() => {}}>
      <DialogContent hideCloseButton className="w-[88vw] max-w-sm rounded-3xl border-[3px] border-charcoal bg-card p-6 pt-10 pb-8" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-center text-lg">
            {hasActionRequired ? '⚠️ Payment Action Required' : '💳 Connect a Payment Method'}
          </DialogTitle>
          <DialogDescription className="text-center text-balance max-w-[260px] mx-auto">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4 flex flex-col items-center">
          <Button
            onClick={handleConnectStripe}
            disabled={isConnectingPayPal || isVerifying}
            className="w-64 h-14 rounded-full bg-muted text-foreground hover:bg-muted/80 border-none shadow-none ring-0 outline-none focus-visible:ring-0 flex items-center justify-center gap-2.5 text-[14px] font-medium"
          >
            <img src={stripeLogo} alt="Stripe" className="h-6 w-auto object-contain rounded" />
            {stripeActionRequired ? (
              <span className="flex items-center gap-1.5">
                Stripe <span className="text-amber-600 text-xs font-semibold">⚠️ Action Required</span>
              </span>
            ) : 'Connect Stripe'}
          </Button>
          <Button
            onClick={handleConnectPayPal}
            disabled={isConnectingPayPal || isVerifying}
            className="w-64 h-14 rounded-full bg-muted text-foreground hover:bg-muted/80 border-none shadow-none ring-0 outline-none focus-visible:ring-0 flex items-center justify-center gap-2.5 text-[14px] font-medium"
          >
            <img src={paypalLogo} alt="PayPal" className="h-5 w-auto object-contain" />
            {isConnectingPayPal ? 'Connecting...' : paypalActionRequired ? (
              <span className="flex items-center gap-1.5">
                PayPal <span className="text-amber-600 text-xs font-semibold">⚠️ Action Required</span>
              </span>
            ) : 'Connect PayPal'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              navigate(-1);
            }}
            disabled={isVerifying}
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
        if (!v) handleStripeOnboardingComplete();
      }}
      onComplete={handleStripeOnboardingComplete}
    />
    </>
  );
};

export default ConnectPaymentDialog;

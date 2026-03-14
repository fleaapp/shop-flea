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
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import stripeLogo from '@/assets/logo-stripe.jpeg';
import paypalLogo from '@/assets/logo-paypal.png';

interface ConnectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ConnectPaymentDialog = ({ open, onOpenChange }: ConnectPaymentDialogProps) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectStripe = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }

    setIsConnecting(true);
    try {
      const stripeAccountId = (profile as any)?.stripe_account_id || undefined;
      const { data, error } = await invokeCloudFunction('stripe-connect-onboard', {
        stripeAccountId,
        returnUrl: window.location.origin + '/settings',
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      // Save account ID before redirecting
      if (data.accountId) {
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
      }

      // Mark that we're coming from the connect flow
      localStorage.setItem('flea_stripe_pending', 'true');
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Stripe Connect error:', error);
      toast.error('Failed to start Stripe connection. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
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
            disabled={isConnecting}
            className="w-64 h-11 rounded-full bg-charcoal text-white hover:bg-charcoal-light border-none shadow-none ring-0 outline-none focus-visible:ring-0 flex items-center justify-center gap-2"
          >
            {isConnecting ? 'Connecting...' : <><img src={stripeLogo} alt="Stripe" className="h-5 w-auto object-contain" /> Connect Stripe</>}
          </Button>
          <Button
            disabled
            className="w-64 h-11 rounded-full opacity-50 border-none shadow-none ring-0 outline-none focus-visible:ring-0 text-xs"
            variant="outline"
          >
            <img src={paypalLogo} alt="PayPal" className="h-4 inline-block mr-1.5" /> Connect PayPal (Coming Soon)
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
  );
};

export default ConnectPaymentDialog;

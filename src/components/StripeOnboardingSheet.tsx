import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import stripeLogo from '@/assets/logo-stripe.png';

interface StripeOnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const StripeOnboardingSheet = ({
  open,
  onOpenChange,
  onComplete,
}: StripeOnboardingSheetProps) => {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }

    setIsLoading(true);
    try {
      // Only reuse account if onboarding was previously completed
      const onboardingComplete = (profile as any)?.stripe_onboarding_complete === true;
      const existingAccountId = onboardingComplete ? (profile as any)?.stripe_account_id : undefined;

      const { data, error } = await invokeCloudFunction('stripe-connect-onboard', {
        returnUrl: window.location.origin + '/settings',
        stripeAccountId: existingAccountId,
        forceNew: !onboardingComplete,
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      // Redirect to Stripe-hosted onboarding / login
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Stripe onboard error:', err);
      toast.error(err?.message || 'Failed to start Stripe connection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-[3px] border-charcoal p-0 flex flex-col"
      >
        <div className="px-5 pt-8 pb-8 flex flex-col items-center text-center gap-5">
          <img src={stripeLogo} alt="Stripe" className="h-10 w-auto object-contain" />

          <SheetHeader className="space-y-2">
            <SheetTitle className="text-lg">Connect with Stripe</SheetTitle>
            <p className="text-sm text-muted-foreground text-balance max-w-[300px] mx-auto">
              You'll be redirected to Stripe to sign in or create an account. Stripe handles all payments, payouts and compliance.
            </p>
          </SheetHeader>

          <div className="bg-muted/60 rounded-xl px-4 py-3 text-left w-full">
            <p className="text-xs font-semibold text-foreground mb-1.5">🚨 Please read 🚨</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If you are creating a new Stripe account, Stripe will ask for business details - this is standard for all Stripe accounts, even personal ones. Simply select <span className="font-medium text-foreground">Individual / Sole trader</span> and enter your personal information. You don't need a registered business to sell on Flea.
            </p>
          </div>

          <div className="w-full space-y-3 mt-2 flex flex-col items-center">
            <Button
              onClick={handleContinue}
              disabled={isLoading}
              className="w-52 h-12 rounded-full bg-charcoal text-white hover:bg-charcoal/90 text-[15px] font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                'Continue to Stripe'
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="w-full h-10 text-muted-foreground"
            >
              Cancel
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Flea never stores your bank details. Stripe manages everything securely.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StripeOnboardingSheet;

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import fleaLogo from '@/assets/flea-logo.png';

interface SellerOnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stripeActionRequired?: boolean;
}

const TOTAL_STEPS = 3;

const SellerOnboardingSheet = ({
  open,
  onOpenChange,
  stripeActionRequired = false,
}: SellerOnboardingSheetProps) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [legalName, setLegalName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset on open. Prefill from profile if available.
  useEffect(() => {
    if (open) {
      setStep(1);
      const existing =
        (profile as any)?.legal_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
      setLegalName(existing || '');
    }
  }, [open, profile]);

  const handleContinueFromName = async () => {
    const trimmed = legalName.trim();
    if (trimmed.length < 2) {
      toast.error('Please enter your full legal name.');
      return;
    }
    if (!user) return;

    // Persist legal_name. Also split into first/last for Stripe prefill.
    const parts = trimmed.split(/\s+/);
    const first_name = parts[0];
    const last_name = parts.slice(1).join(' ') || null;

    try {
      await supabase
        .from('profiles')
        .update({
          legal_name: trimmed,
          first_name,
          last_name,
        } as any)
        .eq('user_id', user.id);
    } catch (e) {
      console.warn('legal_name persist failed (non-blocking):', e);
    }
    setStep(3);
  };

  const handleContinueToStripe = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to continue.');
      return;
    }
    if (stripeActionRequired) {
      window.open('https://dashboard.stripe.com', '_blank');
      return;
    }

    setIsSubmitting(true);
    try {
      const onboardingComplete = (profile as any)?.stripe_onboarding_complete === true;
      const existingAccountId = onboardingComplete ? (profile as any)?.stripe_account_id : undefined;

      const { data, error } = await invokeCloudFunction('stripe-connect-onboard', {
        returnUrl: window.location.origin + '/create-listing',
        stripeAccountId: existingAccountId,
        forceNew: !onboardingComplete,
        prefillName: legalName.trim() || undefined,
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Seller onboarding error:', err);
      toast.error(err?.message || 'Failed to start setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ProgressDots = () => (
    <div className="flex items-center justify-center gap-1.5 mb-1">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-[3px] border-charcoal p-0 flex flex-col"
      >
        <div className="px-5 pt-7 pb-8 flex flex-col items-center text-center gap-5">
          <ProgressDots />
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </p>

          {step === 1 && (
            <>
              <img src={fleaLogo} alt="FLEA" className="h-11 w-auto" />
              <SheetHeader className="space-y-2">
                <SheetTitle className="text-xl">Start selling on Flea</SheetTitle>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
                  List items in minutes and get paid securely.
                </p>
              </SheetHeader>
              <div className="w-full space-y-3 mt-4 flex flex-col items-center">
                <Button
                  onClick={() => setStep(2)}
                  className="w-52 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold"
                >
                  Continue
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="w-full h-10 text-muted-foreground"
                >
                  Not now
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <SheetHeader className="space-y-2">
                <SheetTitle className="text-lg">Your name (for payments)</SheetTitle>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
                  This must match your bank account details.
                </p>
              </SheetHeader>
              <div className="w-full max-w-[320px] mx-auto mt-2">
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Full legal name"
                  autoFocus
                  autoComplete="name"
                  className="h-12 rounded-xl text-base text-center"
                />
              </div>
              <div className="w-full space-y-3 mt-3 flex flex-col items-center">
                <Button
                  onClick={handleContinueFromName}
                  disabled={legalName.trim().length < 2}
                  className="w-52 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold"
                >
                  Continue
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="w-full h-10 text-muted-foreground"
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <SheetHeader className="space-y-2">
                <SheetTitle className="text-lg">Secure payment setup</SheetTitle>
                <p className="text-sm text-muted-foreground text-pretty leading-relaxed max-w-[340px] mx-auto">
                  To get paid, we securely connect your bank account through our payment provider. Flea never holds your money.
                </p>
              </SheetHeader>

              <div className="bg-muted/60 rounded-xl px-4 py-3 text-center max-w-[310px] w-full">
                <p className="text-xs font-semibold text-foreground mb-1.5">🚨 Please read 🚨</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You'll be asked for some business details — this is standard. Simply select{' '}
                  <span className="font-medium text-foreground">Individual / Sole trader</span> and enter your personal information. You don't need a registered business to sell on Flea.
                </p>
              </div>

              <div className="w-full space-y-3 mt-2 flex flex-col items-center">
                <Button
                  onClick={handleContinueToStripe}
                  disabled={isSubmitting}
                  className="w-56 h-12 rounded-full bg-charcoal text-white hover:bg-charcoal/90 text-[15px] font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    'Continue to secure setup'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="w-full h-10 text-muted-foreground"
                >
                  Back
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[280px]">
                Flea never stores your bank details. Our payment provider manages everything securely.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SellerOnboardingSheet;

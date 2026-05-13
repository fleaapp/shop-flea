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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import fleaLogo from '@/assets/flea-logo.png';

interface SellerOnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stripeActionRequired?: boolean;
  /** Where Stripe should redirect back to. Defaults to current page. */
  returnUrl?: string;
  onComplete?: () => void;
}

const TOTAL_STEPS = 4;
const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const secondaryActionClass = "w-auto h-10 px-4 rounded-full bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus:bg-transparent focus:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-transparent active:bg-muted/60 active:text-foreground";

const isStandaloneWebApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const prepareExternalProviderWindow = () => {
  if (!isStandaloneWebApp()) return null;

  const providerWindow = window.open('', '_blank');
  if (!providerWindow) return null;

  providerWindow.opener = null;
  providerWindow.document.title = 'Opening secure setup';
  providerWindow.document.body.style.margin = '0';
  providerWindow.document.body.style.background = '#F5F1EB';
  return providerWindow;
};

const SellerOnboardingSheet = ({
  open,
  onOpenChange,
  stripeActionRequired = false,
  returnUrl,
  onComplete,
}: SellerOnboardingSheetProps) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState(''); // YYYY-MM-DD
  const [dobInput, setDobInput] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');

  // Reset on open. Prefill from profile if available.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    const p: any = profile || {};
    setFirstName(p.first_name || '');
    setLastName(p.last_name || '');
    setDob('');
    setDobInput('');
    setPhone('');
    setLine1('');
    setSuburb('');
    setState('');
    setPostcode('');
  }, [open, profile]);

  const validatePersonal = () => {
    if (firstName.trim().length < 1 || lastName.trim().length < 1) {
      return 'Please enter your full legal name.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Please enter your date of birth.';
    const [yStr, mStr, dStr] = dob.split('-');
    const dobDate = new Date(Date.UTC(+yStr, +mStr - 1, +dStr));
    if (Number.isNaN(dobDate.getTime())) return 'Invalid date of birth.';
    const ageYears = (Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (ageYears < 18) return 'You must be 18 or older to sell on Flea.';
    if (ageYears > 120) return 'Please check your date of birth.';
    if (!/^[\d+\s()-]{8,}$/.test(phone.trim())) return 'Please enter a valid phone number.';
    return null;
  };

  const handleDobChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length <= 2
      ? digits
      : digits.length <= 4
        ? `${digits.slice(0, 2)}/${digits.slice(2)}`
        : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;

    setDobInput(formatted);
    setDob(digits.length === 8 ? `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}` : '');
  };

  const validateAddress = () => {
    if (!line1.trim()) return 'Please enter your street address.';
    if (!suburb.trim()) return 'Please enter your suburb.';
    if (!state) return 'Please select your state.';
    if (!/^\d{4}$/.test(postcode.trim())) return 'Please enter a valid 4-digit postcode.';
    return null;
  };

  const handlePersonalNext = async () => {
    const err = validatePersonal();
    if (err) {
      toast.error(err);
      return;
    }
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            legal_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          } as any)
          .eq('user_id', user.id);
      } catch (e) {
        console.warn('profile name persist failed (non-blocking):', e);
      }
    }
    setStep(3);
  };

  const handleAddressNext = () => {
    const err = validateAddress();
    if (err) {
      toast.error(err);
      return;
    }
    setStep(4);
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

    const providerWindow = prepareExternalProviderWindow();
    setIsSubmitting(true);
    try {
      const onboardingComplete = (profile as any)?.stripe_onboarding_complete === true;
      const existingAccountId = onboardingComplete ? (profile as any)?.stripe_account_id : undefined;

      const [yStr, mStr, dStr] = dob.split('-');

      const { data, error } = await invokeCloudFunction('stripe-connect-onboard', {
        returnUrl: returnUrl || window.location.href.split('?')[0],
        stripeAccountId: existingAccountId,
        forceNew: !onboardingComplete,
        prefill: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob: { year: +yStr, month: +mStr, day: +dStr },
          phone: phone.trim(),
          address: {
            line1: line1.trim(),
            city: suburb.trim(),
            state,
            postal_code: postcode.trim(),
            country: 'AU',
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      onComplete?.();
      if (providerWindow && !providerWindow.closed) {
        providerWindow.location.replace(data.url);
        return;
      }

      window.location.assign(data.url);
    } catch (err: any) {
      if (providerWindow && !providerWindow.closed) providerWindow.close();
      console.error('Seller onboarding error:', err);
      toast.error(err?.message || 'Failed to start setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ProgressDots = () => (
    <div className="flex items-center justify-center gap-1.5 mb-1">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );

  const secondaryAction = (className = '') => `${secondaryActionClass} ${className}`.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-[3px] border-charcoal p-0 flex flex-col max-h-[92svh] bg-background"
      >
        <div className="px-5 pt-7 pb-8 flex flex-col items-center text-center gap-5 overflow-x-hidden overflow-y-auto">
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
                  We'll collect a few quick details - your name, date of birth, phone and address - so the secure payment setup at the end is fast.
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
                  className={secondaryAction()}
                >
                  Not now
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <SheetHeader className="space-y-2 w-full max-w-[280px] mx-auto items-center text-center">
                <SheetTitle className="text-lg text-center">Your details</SheetTitle>
                <p className="text-sm text-muted-foreground leading-relaxed text-center">
                  This must match your bank account and ID for payout verification.
                </p>
              </SheetHeader>
              <div className="w-[230px] max-w-[calc(100vw-96px)] mx-auto text-left space-y-3 mt-1">
                <div className="space-y-1">
                  <Label htmlFor="fn" className="text-xs">First name</Label>
                  <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="w-full" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ln" className="text-xs">Last name</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className="w-full" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dob" className="text-xs">Date of birth</Label>
                  <Input id="dob" type="text" inputMode="numeric" placeholder="DD/MM/YYYY" value={dobInput} onChange={(e) => handleDobChange(e.target.value)} className="w-full h-10 text-base" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs">Phone</Label>
                  <Input id="phone" type="tel" inputMode="tel" placeholder="04xx xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className="w-full" />
                </div>
              </div>
              <div className="w-full space-y-3 mt-3 flex flex-col items-center">
                <Button
                  onClick={handlePersonalNext}
                  className="w-52 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold"
                >
                  Continue
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className={secondaryAction()}
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <SheetHeader className="space-y-2">
                <SheetTitle className="text-lg">Your address</SheetTitle>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
                  Used to verify your identity for payouts. Australian addresses only.
                </p>
              </SheetHeader>
              <div className="w-full text-left space-y-3 mt-1">
                <div className="space-y-1">
                  <Label htmlFor="addr" className="text-xs">Street address</Label>
                  <Input id="addr" value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="address-line1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="suburb" className="text-xs">Suburb</Label>
                    <Input id="suburb" value={suburb} onChange={(e) => setSuburb(e.target.value)} autoComplete="address-level2" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="state" className="text-xs">State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger id="state"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {AU_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="postcode" className="text-xs">Postcode</Label>
                  <Input id="postcode" inputMode="numeric" maxLength={4} value={postcode} onChange={(e) => setPostcode(e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" />
                </div>
              </div>
              <div className="w-full space-y-3 mt-3 flex flex-col items-center">
                <Button
                  onClick={handleAddressNext}
                  className="w-52 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold"
                >
                  Continue
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className={secondaryAction()}
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <SheetHeader className="space-y-2">
                <SheetTitle className="text-lg">Secure payment setup</SheetTitle>
                <p className="text-sm text-muted-foreground text-pretty leading-relaxed max-w-[340px] mx-auto">
                  We'll pass these details securely to our payment provider. Follow the prompts to finish your bank details and any required verification.
                </p>
              </SheetHeader>

              <div className="bg-muted/60 rounded-xl px-4 py-3 text-left max-w-[340px] w-full space-y-2">
                <p className="text-xs font-semibold text-foreground">⏱️ Please note</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Due to security checks and verification, your <span className="font-medium text-foreground">first payout may take around 7 days</span>.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  After that, payouts usually arrive in <span className="font-medium text-foreground">1–2 business days</span>, or via <span className="font-medium text-foreground">Instant Payout (≈30 mins)</span> for a 1.5% fee.
                </p>
              </div>

              <div className="bg-muted/60 rounded-xl px-4 py-2.5 text-center max-w-[340px] w-full">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  If asked for a business type, select <span className="font-medium text-foreground">Individual / Sole trader</span>. You don't need a registered business to sell on Flea.
                </p>
              </div>

              <div className="w-full space-y-2 mt-1 flex flex-col items-center">
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
                  onClick={() => setStep(3)}
                  disabled={isSubmitting}
                  className={secondaryAction('h-9')}
                >
                  Back
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground/70 max-w-[280px]">
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

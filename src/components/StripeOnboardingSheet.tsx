import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import stripeLogo from '@/assets/logo-stripe.png';

interface StripeOnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const StripeOnboardingSheet = ({
  open,
  onOpenChange,
  onComplete,
}: StripeOnboardingSheetProps) => {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState(''); // YYYY-MM-DD
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');

  useEffect(() => {
    if (!open) return;
    const p: any = profile || {};
    setFirstName((prev) => prev || p.first_name || '');
    setLastName((prev) => prev || p.last_name || '');
  }, [open, profile]);

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) return 'Please enter your full legal name.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Please enter your date of birth.';
    const [yStr, mStr, dStr] = dob.split('-');
    const y = +yStr, m = +mStr, d = +dStr;
    const dobDate = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(dobDate.getTime())) return 'Invalid date of birth.';
    const ageMs = Date.now() - dobDate.getTime();
    const ageYears = ageMs / (365.25 * 24 * 3600 * 1000);
    if (ageYears < 18) return 'You must be 18 or older to sell on Flea.';
    if (ageYears > 120) return 'Please check your date of birth.';
    if (!/^[\d+\s()-]{8,}$/.test(phone.trim())) return 'Please enter a valid phone number.';
    if (!line1.trim()) return 'Please enter your street address.';
    if (!suburb.trim()) return 'Please enter your suburb.';
    if (!state) return 'Please select your state.';
    if (!/^\d{4}$/.test(postcode.trim())) return 'Please enter a valid 4-digit postcode.';
    return null;
  };

  const handleContinue = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }

    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setIsLoading(true);
    try {
      const onboardingComplete = (profile as any)?.stripe_onboarding_complete === true;
      const existingAccountId = onboardingComplete ? (profile as any)?.stripe_account_id : undefined;

      const [yStr, mStr, dStr] = dob.split('-');

      const { data, error } = await invokeCloudFunction('stripe-connect-onboard', {
        returnUrl: window.location.origin + '/settings',
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
        className="rounded-t-3xl border-t-[3px] border-charcoal p-0 flex flex-col max-h-[92svh]"
      >
        <div className="px-5 pt-6 pb-8 flex flex-col items-center text-center gap-4 overflow-y-auto">
          <img src={stripeLogo} alt="Stripe" className="h-9 w-auto object-contain" />

          <SheetHeader className="space-y-1.5">
            <SheetTitle className="text-lg">Connect with Stripe</SheetTitle>
            <p className="text-[13px] text-muted-foreground text-pretty leading-relaxed max-w-[360px] mx-auto">
              Enter your details below so all you'll need to do on Stripe is set a password and add your bank account.
            </p>
          </SheetHeader>

          <div className="w-full text-left space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fn" className="text-xs">First name</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ln" className="text-xs">Last name</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dob" className="text-xs">Date of birth</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">Phone</Label>
                <Input id="phone" type="tel" inputMode="tel" placeholder="04xx xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
            </div>

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

          <div className="bg-muted/60 rounded-xl px-4 py-2.5 text-center max-w-[340px] w-full mt-1">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We send these details to Stripe so you only need to set a password and add your bank account. Select <span className="font-medium text-foreground">Individual / Sole trader</span> if asked.
            </p>
          </div>

          <div className="w-full space-y-2 mt-1 flex flex-col items-center">
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
              className="w-full h-9 text-muted-foreground"
            >
              Cancel
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            Flea never stores your bank details. Stripe manages everything securely.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StripeOnboardingSheet;

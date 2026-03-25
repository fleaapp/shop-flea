import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2, Lock } from 'lucide-react';

const AU_STATES = [
  { value: 'ACT', label: 'ACT' },
  { value: 'NSW', label: 'NSW' },
  { value: 'NT', label: 'NT' },
  { value: 'QLD', label: 'QLD' },
  { value: 'SA', label: 'SA' },
  { value: 'TAS', label: 'TAS' },
  { value: 'VIC', label: 'VIC' },
  { value: 'WA', label: 'WA' },
];

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

interface StripeOnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const TOTAL_STEPS = 4;

const StripeOnboardingSheet = ({
  open,
  onOpenChange,
  onComplete,
}: StripeOnboardingSheetProps) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: (profile as any)?.first_name || '',
    lastName: (profile as any)?.last_name || '',
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    bsb: '',
    accountNumber: '',
    confirmAccountNumber: '',
    tosAccepted: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatBsb = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 6);
    if (digits.length > 3) {
      return digits.slice(0, 3) + '-' + digits.slice(3);
    }
    return digits;
  };

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 0: {
        if (!formData.firstName.trim()) return 'First name is required';
        if (!formData.lastName.trim()) return 'Last name is required';
        if (!formData.dobDay || !formData.dobMonth || !formData.dobYear)
          return 'Date of birth is required';
        const year = parseInt(formData.dobYear);
        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear - 18)
          return 'You must be at least 18 years old';
        const day = parseInt(formData.dobDay);
        if (day < 1 || day > 31) return 'Invalid day';
        return null;
      }
      case 1: {
        if (!formData.addressLine1.trim()) return 'Street address is required';
        if (!formData.city.trim()) return 'City / suburb is required';
        if (!formData.state) return 'State is required';
        if (!formData.postalCode.trim()) return 'Postcode is required';
        if (!/^\d{4}$/.test(formData.postalCode))
          return 'Postcode must be 4 digits';
        return null;
      }
      case 2: {
        const cleanBsb = formData.bsb.replace(/[^0-9]/g, '');
        if (cleanBsb.length !== 6) return 'BSB must be 6 digits';
        if (!formData.accountNumber.trim()) return 'Account number is required';
        const cleanAcct = formData.accountNumber.replace(/[^0-9]/g, '');
        if (cleanAcct.length < 5 || cleanAcct.length > 10)
          return 'Account number must be 5–10 digits';
        if (formData.accountNumber !== formData.confirmAccountNumber)
          return 'Account numbers do not match';
        return null;
      }
      case 3: {
        if (!formData.tosAccepted)
          return 'You must accept the terms to continue';
        return null;
      }
      default:
        return null;
    }
  };

  const handleNext = () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    if (!user) return;

    setIsSubmitting(true);
    try {
      const existingAccountId =
        (profile as any)?.stripe_account_id || undefined;

      const { data, error: fnError } = await invokeCloudFunction(
        'stripe-custom-onboard',
        {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          dobDay: formData.dobDay,
          dobMonth: formData.dobMonth,
          dobYear: formData.dobYear,
          addressLine1: formData.addressLine1.trim(),
          addressLine2: formData.addressLine2.trim(),
          city: formData.city.trim(),
          state: formData.state,
          postalCode: formData.postalCode.trim(),
          bsb: formData.bsb,
          accountNumber: formData.accountNumber,
          returnUrl: window.location.origin + '/settings',
          existingAccountId,
        }
      );

      if (fnError) throw fnError;

      // Persist account ID client-side too
      if (data?.accountId) {
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
      }

      if (data?.verificationUrl) {
        // Redirect to Stripe for ID verification
        toast('⏳ Redirecting to verify your identity...');
        window.location.href = data.verificationUrl;
      } else if (data?.requirementsComplete) {
        // Fully complete — no verification needed
        toast.success('✅ Stripe account connected!');
        onOpenChange(false);
        onComplete?.();
      } else {
        toast.success('✅ Details submitted! Stripe is reviewing your account.');
        onOpenChange(false);
        onComplete?.();
      }
    } catch (err: any) {
      console.error('Stripe custom onboard error:', err);
      const message =
        err?.message || err?.error || 'Something went wrong. Please try again.';
      toast.error(`❌ ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    onOpenChange(false);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) =>
    String(currentYear - 18 - i)
  );
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="h-[88vh] rounded-t-3xl border-t-[3px] border-charcoal p-0 flex flex-col"
      >
        {/* Progress */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex gap-1.5 mb-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-charcoal' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            Step {step + 1} of {TOTAL_STEPS}
          </p>
        </div>

        <SheetHeader className="px-6 pb-2 text-left">
          <SheetTitle className="text-lg">
            {step === 0 && '👤 Personal Details'}
            {step === 1 && '📍 Home Address'}
            {step === 2 && '🏦 Bank Details'}
            {step === 3 && '✅ Review & Confirm'}
          </SheetTitle>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName" className="text-sm font-medium">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  placeholder="Jane"
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="Smith"
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Date of Birth</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.dobDay}
                    onValueChange={(v) => updateField('dobDay', v)}
                  >
                    <SelectTrigger className="flex-1 rounded-xl border-border bg-card">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.dobMonth}
                    onValueChange={(v) => updateField('dobMonth', v)}
                  >
                    <SelectTrigger className="flex-[2] rounded-xl border-border bg-card">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.dobYear}
                    onValueChange={(v) => updateField('dobYear', v)}
                  >
                    <SelectTrigger className="flex-1 rounded-xl border-border bg-card">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="addressLine1" className="text-sm font-medium">
                  Street Address
                </Label>
                <Input
                  id="addressLine1"
                  value={formData.addressLine1}
                  onChange={(e) => updateField('addressLine1', e.target.value)}
                  placeholder="123 Example St"
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div>
                <Label htmlFor="addressLine2" className="text-sm font-medium">
                  Apartment / Unit{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="addressLine2"
                  value={formData.addressLine2}
                  onChange={(e) => updateField('addressLine2', e.target.value)}
                  placeholder="Unit 4"
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div>
                <Label htmlFor="city" className="text-sm font-medium">
                  City / Suburb
                </Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Sydney"
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-medium">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(v) => updateField('state', v)}
                  >
                    <SelectTrigger className="mt-1.5 rounded-xl border-border bg-card">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {AU_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="postalCode" className="text-sm font-medium">
                    Postcode
                  </Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) =>
                      updateField(
                        'postalCode',
                        e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                      )
                    }
                    placeholder="2000"
                    inputMode="numeric"
                    className="mt-1.5 rounded-xl border-border bg-card"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="bsb" className="text-sm font-medium">
                  BSB
                </Label>
                <Input
                  id="bsb"
                  value={formData.bsb}
                  onChange={(e) =>
                    updateField('bsb', formatBsb(e.target.value))
                  }
                  placeholder="000-000"
                  inputMode="numeric"
                  maxLength={7}
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div>
                <Label htmlFor="accountNumber" className="text-sm font-medium">
                  Account Number
                </Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    updateField(
                      'accountNumber',
                      e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                    )
                  }
                  placeholder="123456789"
                  inputMode="numeric"
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div>
                <Label
                  htmlFor="confirmAccountNumber"
                  className="text-sm font-medium"
                >
                  Confirm Account Number
                </Label>
                <Input
                  id="confirmAccountNumber"
                  value={formData.confirmAccountNumber}
                  onChange={(e) =>
                    updateField(
                      'confirmAccountNumber',
                      e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                    )
                  }
                  placeholder="123456789"
                  inputMode="numeric"
                  className="mt-1.5 rounded-xl border-border bg-card"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-3">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your bank details are sent securely to Stripe and never stored
                  by Flea.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/50 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">
                    {formData.firstName} {formData.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date of Birth</span>
                  <span className="font-medium">
                    {formData.dobDay}/{formData.dobMonth}/{formData.dobYear}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span className="font-medium text-right max-w-[55%]">
                    {formData.addressLine1}
                    {formData.addressLine2
                      ? `, ${formData.addressLine2}`
                      : ''}
                    , {formData.city} {formData.state} {formData.postalCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BSB</span>
                  <span className="font-medium">{formData.bsb}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-medium">
                    ••••{formData.accountNumber.slice(-4)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <Checkbox
                  id="tos"
                  checked={formData.tosAccepted}
                  onCheckedChange={(checked) =>
                    updateField('tosAccepted', !!checked)
                  }
                  className="mt-0.5"
                />
                <Label htmlFor="tos" className="text-sm leading-snug">
                  I agree to the{' '}
                  <a
                    href="https://stripe.com/au/legal/connect-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-muted-foreground"
                  >
                    Stripe Connected Account Agreement
                  </a>{' '}
                  and authorise Flea to facilitate payments through my account.
                </Label>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-3">
                <span className="text-sm">🪪</span>
                <p className="text-xs text-muted-foreground">
                  After submitting, you may be asked to verify your identity
                  with a photo ID. This is a one-time Stripe requirement.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          {step > 0 ? (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-full border-border"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleClose}
              className="flex-1 h-12 rounded-full"
            >
              Cancel
            </Button>
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={handleNext}
              className="flex-1 h-12 rounded-full bg-charcoal text-white hover:bg-charcoal/90"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.tosAccepted}
              className="flex-1 h-12 rounded-full bg-charcoal text-white hover:bg-charcoal/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit & Verify'
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StripeOnboardingSheet;
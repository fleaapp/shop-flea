import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Lock } from 'lucide-react';
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
import AddressAutocomplete from '@/components/AddressAutocomplete';
import IdVerificationStep from '@/components/IdVerificationStep';
import PushPermissionSheet from '@/components/PushPermissionSheet';
import { shouldShowPushPromptAsync } from '@/lib/pushPrompt';
import { setOnboardingResume, clearOnboardingResume, setOnboardingStep, getOnboardingStep } from '@/lib/sellerOnboardingResume';

interface SellerOnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stripeActionRequired?: boolean;
  /** When true, opens directly on the live-camera ID verification step. */
  needsIdVerification?: boolean;
  /** Structured verification error from Stripe requirements.errors[0]. */
  verificationError?: { code: string | null; reason: string | null; nameMismatch: boolean } | null;
  /** Where Stripe should redirect back to. Defaults to current page. */
  returnUrl?: string;
  onComplete?: (result?: { setupCompleted?: boolean }) => void;
}

const TOTAL_STEPS = 5;
const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const secondaryActionClass = "w-auto h-10 px-4 rounded-full bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus:bg-transparent focus:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-transparent active:bg-muted/60 active:text-foreground";

// Local draft persistence so users can leave the app (e.g. to grab their BSB /
// account number) and return without losing what they've entered.
const draftKey = (userId?: string | null) =>
  userId ? `flea_seller_onboarding_draft_${userId}` : null;
export type OnboardingDraft = Partial<{
  firstName: string; lastName: string; dob: string; dobInput: string; phone: string;
  line1: string; suburb: string; state: string; postcode: string;
  bsb: string; account: string;
}>;
const loadDraft = (userId?: string | null): OnboardingDraft => {
  const k = draftKey(userId); if (!k) return {};
  try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch { return {}; }
};
const saveDraft = (userId: string | null | undefined, patch: OnboardingDraft) => {
  const k = draftKey(userId); if (!k) return;
  try {
    const cur = loadDraft(userId);
    localStorage.setItem(k, JSON.stringify({ ...cur, ...patch }));
  } catch { /* non-blocking */ }
};
const clearOnboardingDraft = (userId?: string | null) => {
  const k = draftKey(userId); if (!k) return;
  try { localStorage.removeItem(k); } catch { /* non-blocking */ }
};

const SellerOnboardingSheet = ({
  open,
  onOpenChange,
  stripeActionRequired = false,
  needsIdVerification = false,
  verificationError = null,
  returnUrl,
  onComplete,
}: SellerOnboardingSheetProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPushSheet, setShowPushSheet] = useState(false);

  const handleVerifiedSuccess = (result?: { setupCompleted?: boolean }) => {
    clearOnboardingDraft(user?.id);
    clearOnboardingResume(user?.id);
    onOpenChange(false);
    shouldShowPushPromptAsync(user?.id, 'seller_verified').then((show) => {
      if (show) setTimeout(() => setShowPushSheet(true), 300);
    });
    onComplete?.(result);
  };

  // Explicit user-close (X, backdrop, "Not now") → clear the resume flag so
  // we don't reopen on next launch. Backgrounding does NOT fire this.
  const handleOpenChange = (next: boolean) => {
    if (!next) clearOnboardingResume(user?.id);
    onOpenChange(next);
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState(''); // YYYY-MM-DD
  const [dobInput, setDobInput] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');

  // Reset on open. Prefill from profile, then override with any locally-saved
  // draft so users who left the app mid-flow (e.g. to grab their BSB) come
  // back to exactly what they had entered.
  //
  // NOTE: deps intentionally exclude `profile` — on app resume the AuthContext
  // hands back a new profile reference, and re-running this effect would
  // clobber the current step (dropping the user back to step 1). Local step
  // storage (below) is authoritative for resume; profile is only a fallback.
  useEffect(() => {
    if (!open) return;
    const p: any = profile || {};
    const localStep = getOnboardingStep(user?.id);
    const dbStep = Number(p.stripe_onboarding_step);
    const resumeStep: 1 | 2 | 3 | 4 | 5 =
      localStep ??
      (dbStep >= 1 && dbStep <= 5 ? (dbStep as 1 | 2 | 3 | 4 | 5) : 1);
    setStep(resumeStep);
    const d = loadDraft(user?.id);
    setFirstName(d.firstName ?? p.first_name ?? '');
    setLastName(d.lastName ?? p.last_name ?? '');
    setDob(d.dob ?? '');
    setDobInput(d.dobInput ?? '');
    setPhone(d.phone ?? '');
    setLine1(d.line1 ?? '');
    setSuburb(d.suburb ?? '');
    setState(d.state ?? '');
    setPostcode(d.postcode ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  // Autosave form drafts locally while the sheet is open.
  useEffect(() => {
    if (!open || !user?.id) return;
    saveDraft(user.id, { firstName, lastName, dob, dobInput, phone, line1, suburb, state, postcode });
  }, [open, user?.id, firstName, lastName, dob, dobInput, phone, line1, suburb, state, postcode]);

  // When re-opened for an existing account that Stripe has flagged for more info
  // (charges/payouts disabled or requirements past-due), probe live status and
  // route the user straight to the native step that resolves the block. We
  // never send them off to a Stripe-hosted page.
  useEffect(() => {
    if (!open || needsIdVerification) return;
    const accountId = (profile as any)?.stripe_account_id;
    if (!stripeActionRequired || !accountId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await invokeCloudFunction('stripe-connect-status', { stripeAccountId: accountId });
        if (cancelled || !data) return;
        const due: string[] = [
          ...((data as any).currentlyDue || []),
          ...((data as any).pastDue || []),
        ];
        // External account (bank) missing or invalid — jump straight to bank step.
        if (due.some((r) => r.startsWith('external_account'))) {
          setStep(5);
          return;
        }
        // Address requirement — jump to address step.
        if (due.some((r) => r.includes('address'))) {
          setStep(4);
          return;
        }
        // Otherwise assume personal info is what's needed.
        setStep(3);
      } catch {
        // Non-blocking; keep whatever step we resumed on.
      }
    })();
    return () => { cancelled = true; };
  }, [open, stripeActionRequired, needsIdVerification, profile]);



  // Persist step whenever it changes so the user resumes here if they leave
  // the app (e.g. to grab their bank card). Local storage is authoritative
  // (synchronous, cannot fail on RLS); DB write is a best-effort backup.
  useEffect(() => {
    if (!open || !user?.id) return;
    setOnboardingStep(user.id, step);
    (async () => {
      try {
        await supabase
          .from('profiles')
          .update({ stripe_onboarding_step: String(step) } as any)
          .eq('user_id', user.id);
      } catch { /* non-blocking */ }
    })();
  }, [step, open, user?.id]);

  // Once the user has actively engaged (advanced past the intro), remember
  // that onboarding is in progress so a cold-relaunch reopens the sheet.
  useEffect(() => {
    if (!open || !user?.id) return;
    if (step > 1) setOnboardingResume(user.id);
  }, [open, step, user?.id]);

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
    handleContinueToStripe();
  };

  const handleContinueToStripe = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const existingAccountId = (profile as any)?.stripe_account_id || undefined;
      const [yStr, mStr, dStr] = dob.split('-');

      const { data, error } = await invokeCloudFunction('stripe-connect-onboard', {
        stripeAccountId: existingAccountId,
        forceNew: !existingAccountId,
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
      if (!data?.accountId) throw new Error('No account created');

      // Move to the embedded onboarding step — no redirects, no Stripe branding.
      setStep(4);
    } catch (err: any) {
      console.error('Seller onboarding error:', err);
      toast.error(err?.message || 'Failed to start setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ProgressDots = () => (
    <div className="flex items-center justify-center gap-1.5 mb-1">
      {[1, 2, 3, 4, 5].map((n) => (
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="data-[state=closed]:animate-none"
        className="rounded-t-3xl border-0 p-0 flex flex-col max-h-[92svh] bg-background"
        data-seller-onboarding-sheet={open ? 'open' : 'closed'}
      >
        <div className="px-5 pt-7 pb-8 flex flex-col items-center text-center gap-5 overflow-x-hidden overflow-y-auto">
          {needsIdVerification ? (
            <IdVerificationStep
              verificationError={verificationError}
              onEditName={() => {
                // Route user back to the "Your details" step so they can
                // correct their legal name before re-uploading their ID.
                setStep(2);
              }}
              onDone={() => {
                handleVerifiedSuccess();
              }}
            />
          ) : (
            <>
              <ProgressDots />
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Step {step} of {TOTAL_STEPS}
              </p>



          {step === 1 && (
            <>
              <img src={fleaLogo} alt="FLEA" className="h-11 w-auto" />
              <SheetHeader className="space-y-5">
                <SheetTitle className="text-xl">Start selling on Flea</SheetTitle>
                <div className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto space-y-5">
                  <div className="space-y-2">
                    <p>Set up your seller account in just a few minutes.</p>
                    <p>We'll ask for a few details to verify your identity and enable payouts.</p>
                  </div>
                  <div className="space-y-2 text-foreground">
                    <p className="font-semibold">Selling on Flea is free.</p>
                    <p className="font-semibold">You only pay a 2% + $0.50 transaction fee to cover payment processing.</p>
                  </div>
                  <p>
                    By continuing you agree to our{' '}
                    <Link
                      to="/terms"
                      className="underline underline-offset-2 text-foreground hover:text-foreground/80"
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenChange(false);
                        navigate('/terms');
                      }}
                    >
                      Terms & Privacy
                    </Link>
                    .
                  </p>
                </div>
              </SheetHeader>
              <div className="w-full space-y-3 mt-6 flex flex-col items-center">
                <Button
                  onClick={() => setStep(2)}
                  className="w-52 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold"
                >
                  Continue
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className={secondaryAction()}
                >
                  Not now
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-6xl mb-2">🪪</div>
              <SheetHeader className="space-y-4">
                <SheetTitle className="text-xl text-center leading-snug">
                  Your details must match your government-issued ID.
                </SheetTitle>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
                  Our payment processing provider uses this information to confirm your identity and activate seller payouts.
                </p>
              </SheetHeader>
              <div className="w-full space-y-3 mt-6 flex flex-col items-center">
                <Button
                  onClick={() => setStep(3)}
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
              <SheetHeader className="space-y-2 w-full max-w-[280px] mx-auto items-center text-center">
                <SheetTitle className="text-lg text-center">Your details</SheetTitle>
                <p className="text-sm text-muted-foreground leading-relaxed text-center">
                  Used to verify your identity and enable payouts. Your details must match your bank account and government-issued ID. Never shown publicly on your profile.
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
                <SheetTitle className="text-lg">Your address</SheetTitle>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
                  Used to verify your identity and enable payouts. Your details must match your bank account and government-issued ID. Australian addresses only. Never shown publicly on your profile.
                </p>
              </SheetHeader>
              <div className="w-full text-left space-y-3 mt-1">
                <div className="space-y-1">
                  <Label htmlFor="addr" className="text-xs">Street address</Label>
                  <AddressAutocomplete
                    value={line1}
                    onChange={setLine1}
                    onSelect={(addr) => {
                      if (addr.street) setLine1(addr.street);
                      if (addr.suburb || addr.city) setSuburb(addr.suburb || addr.city);
                      if (addr.state) setState(addr.state);
                      if (addr.postcode) setPostcode(addr.postcode);
                    }}
                    placeholder="Start typing your address..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="suburb" className="text-xs">Suburb</Label>
                    <Input id="suburb" value={suburb} onChange={(e) => setSuburb(e.target.value)} autoComplete="address-level2" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="state" className="text-xs">State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger id="state" className="h-11 rounded-xl bg-background border-border">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border z-[100]" position="popper">
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
                  disabled={isSubmitting}
                  className="w-56 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold"
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
                  className={secondaryAction()}
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {step === 5 && (
            <BankDetailsStep
              firstName={firstName}
              lastName={lastName}
              onBack={() => setStep(4)}
              onDone={() => handleVerifiedSuccess({ setupCompleted: true })}
            />
          )}
            </>
          )}
        </div>
      </SheetContent>

      <PushPermissionSheet
        open={showPushSheet}
        onOpenChange={setShowPushSheet}
        source="seller_verified"
      />
    </Sheet>
  );
};

interface BankDetailsStepProps {
  firstName: string;
  lastName: string;
  onBack: () => void;
  onDone: () => void;
}

const BankDetailsStep = ({ firstName, lastName, onBack, onDone }: BankDetailsStepProps) => {
  const { user, profile, refreshProfile } = useAuth() as any;
  const initialDraft = loadDraft(user?.id);
  const [bsb, setBsb] = useState<string>(initialDraft.bsb || '');
  const [account, setAccount] = useState<string>(initialDraft.account || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    saveDraft(user.id, { bsb, account });
  }, [user?.id, bsb, account]);

  const formatBsb = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 6);
    return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  };

  const canSubmit = bsb.replace(/\D/g, '').length === 6 && account.replace(/\D/g, '').length >= 5;

  const handleSubmit = async () => {
    const accountId = (profile as any)?.stripe_account_id;
    if (!accountId) {
      toast.error('Payment account not ready. Please go back and try again.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await invokeCloudFunction('stripe-connect-add-bank', {
        accountId,
        bsb: bsb.replace(/\D/g, ''),
        accountNumber: account.replace(/\D/g, ''),
        accountHolderName: `${firstName} ${lastName}`.trim(),
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await supabase
        .from('profiles')
        .update({ stripe_onboarding_step: 'complete' } as any)
        .eq('user_id', profile.user_id);
      toast.success('Bank details saved.');
      try { await refreshProfile?.(); } catch {}
      onDone();
    } catch (err: any) {
      console.error('add-bank error:', err);
      toast.error(err?.message || 'Could not save bank details. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SheetHeader className="space-y-2">
        <SheetTitle className="text-lg">Add bank details</SheetTitle>
      </SheetHeader>

      <div className="w-full max-w-[340px] mx-auto flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-left">
        <Lock className="h-5 w-5 shrink-0 mt-0.5 text-foreground" />
        <p className="text-xs text-foreground/80 leading-relaxed">
          Your bank details are encrypted and stored securely with the highest bank-grade security.
        </p>
      </div>

      <div className="w-full max-w-[340px] mx-auto text-left space-y-4 mt-1">
        <div className="space-y-1.5">
          <Label htmlFor="bsb" className="text-[13px] font-semibold">BSB code</Label>
          <Input
            id="bsb"
            inputMode="numeric"
            placeholder="6 digit code"
            value={bsb}
            onChange={(e) => setBsb(formatBsb(e.target.value))}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acct" className="text-[13px] font-semibold">Account number</Label>
          <Input
            id="acct"
            inputMode="numeric"
            placeholder="6-10 digit code"
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="h-11 text-base"
          />
        </div>
      </div>

      <div className="w-full max-w-[340px] mx-auto text-left space-y-3 text-[12px] text-muted-foreground leading-relaxed">
        <p>
          By providing your bank account details and confirming, you authorise Flea and its payment
          provider to send payouts from your sales to this account.
        </p>
        <p>
          You certify that you are either an account holder or an authorised signatory on the
          account listed above.
        </p>
      </div>

      <div className="w-full space-y-2 mt-2 flex flex-col items-center">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-56 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Confirm'
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={submitting}
          className="w-auto h-10 px-4 rounded-full bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
        >
          Back
        </Button>
      </div>
    </>
  );
};



export default SellerOnboardingSheet;

import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import SellerOnboardingSheet from '@/components/SellerOnboardingSheet';
import { hasOnboardingResume, clearOnboardingResume } from '@/lib/sellerOnboardingResume';

/**
 * Global mount that reopens the SellerOnboardingSheet at the user's saved
 * step when a "resume" flag is present in localStorage. The flag is set once
 * the user has advanced past step 1 and cleared on completion or an explicit
 * close, so cold-relaunching the app (e.g. after leaving to grab a BSB /
 * account number) drops the user straight back into the same step with their
 * draft fields prefilled.
 */
const SellerOnboardingResumeMount = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if ((profile as any)?.stripe_onboarding_complete) return;

    const check = () => {
      if (hasOnboardingResume(user.id)) setOpen(true);
    };

    check();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', check);

    let removeResume: (() => void) | undefined;
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      void import('@capacitor/app')
        .then(({ App }) => App.addListener('resume', check))
        .then((handle) => { removeResume = () => void handle.remove(); })
        .catch(() => undefined);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', check);
      removeResume?.();
    };
  }, [user?.id, profile]);

  if (!user?.id) return null;

  return (
    <SellerOnboardingSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) clearOnboardingResume(user.id);
      }}
      onComplete={() => {
        clearOnboardingResume(user.id);
        setOpen(false);
      }}
    />
  );
};

export default SellerOnboardingResumeMount;

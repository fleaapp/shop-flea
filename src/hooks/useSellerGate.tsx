import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import SellerOnboardingSheet from '@/components/SellerOnboardingSheet';

/**
 * Gates seller-only actions (dashboard, sales, seller offers, pause selling,
 * bundle offers) behind completed seller onboarding.
 */
export function useSellerGate() {
  const { user, profile } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  const localKey = user ? `stripe_onboarding_complete_${user.id}` : null;
  const sellerReady =
    (profile as any)?.stripe_onboarding_complete === true ||
    (typeof window !== 'undefined' && !!localKey && localStorage.getItem(localKey) === 'true');

  const guard = useCallback(
    (action: () => void) => {
      if (!sellerReady) {
        setGateOpen(true);
        return;
      }
      action();
    },
    [sellerReady],
  );

  const gate = (
    <SellerOnboardingSheet open={gateOpen} onOpenChange={setGateOpen} />
  );

  return { sellerReady, guard, gate, gateOpen, setGateOpen };
}

export default useSellerGate;

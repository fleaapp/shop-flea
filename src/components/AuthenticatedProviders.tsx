import type { ReactNode } from "react";
import { CartProvider } from "@/context/CartContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import { GuestModeProvider, useGuestMode } from "@/context/GuestModeContext";
import { useAuth } from "@/context/AuthContext";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import OnboardingCarousel from "@/components/OnboardingCarousel";
import RealtimeAlerts from "@/components/RealtimeAlerts";
import { PushNotificationSubscriber } from "@/components/PushNotificationSubscriber";
import useListingsRealtime from "@/hooks/useListingsRealtime";

const OnboardingChrome = ({ enabled }: { enabled: boolean }) => {
  const { showCarousel, closeCarousel } = useOnboarding();
  const { user } = useAuth();
  const { isGuest } = useGuestMode();

  if (!enabled) return null;

  // Realtime alerts + push subscription remain account-scoped.
  // Onboarding is available to signed-in users AND first-time guests so the
  // walkthrough plays after "Browse as Guest".
  if (!user && !isGuest) return null;

  return (
    <>
      {user && <RealtimeAlerts />}
      {user && <PushNotificationSubscriber />}
      <OnboardingOverlay />
      <OnboardingCarousel open={showCarousel} onComplete={closeCarousel} />
    </>
  );
};

const AuthenticatedProviders = ({ children, enabled }: { children: ReactNode; enabled: boolean }) => {
  useListingsRealtime();
  return (
    <GuestModeProvider>
      <CartProvider>
        <OnboardingProvider>
          <OnboardingChrome enabled={enabled} />
          {children}
        </OnboardingProvider>
      </CartProvider>
    </GuestModeProvider>
  );
};

export default AuthenticatedProviders;
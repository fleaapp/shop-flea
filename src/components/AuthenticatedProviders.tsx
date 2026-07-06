import type { ReactNode } from "react";
import { CartProvider } from "@/context/CartContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import { GuestModeProvider } from "@/context/GuestModeContext";
import { useAuth } from "@/context/AuthContext";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import OnboardingCarousel from "@/components/OnboardingCarousel";
import RealtimeAlerts from "@/components/RealtimeAlerts";
import { PushNotificationSubscriber } from "@/components/PushNotificationSubscriber";

const OnboardingChrome = ({ enabled }: { enabled: boolean }) => {
  const { showCarousel, closeCarousel } = useOnboarding();
  const { user } = useAuth();

  // Onboarding, realtime alerts, and push subscription are all account-scoped.
  // Guests browsing without a session must never see or trigger any of them.
  if (!enabled || !user) return null;

  return (
    <>
      <RealtimeAlerts />
      <PushNotificationSubscriber />
      <OnboardingOverlay />
      <OnboardingCarousel open={showCarousel} onComplete={closeCarousel} />
    </>
  );
};

const AuthenticatedProviders = ({ children, enabled }: { children: ReactNode; enabled: boolean }) => (
  <GuestModeProvider>
    <CartProvider>
      <OnboardingProvider>
        <OnboardingChrome enabled={enabled} />
        {children}
      </OnboardingProvider>
    </CartProvider>
  </GuestModeProvider>
);

export default AuthenticatedProviders;
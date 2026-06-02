import type { ReactNode } from "react";
import { CartProvider } from "@/context/CartContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import OnboardingCarousel from "@/components/OnboardingCarousel";
import RealtimeAlerts from "@/components/RealtimeAlerts";
import { PushNotificationSubscriber } from "@/components/PushNotificationSubscriber";

const OnboardingChrome = ({ enabled }: { enabled: boolean }) => {
  const { showCarousel, closeCarousel } = useOnboarding();

  if (!enabled) return null;

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
  <CartProvider>
    <OnboardingProvider>
      <OnboardingChrome enabled={enabled} />
      {children}
    </OnboardingProvider>
  </CartProvider>
);

export default AuthenticatedProviders;
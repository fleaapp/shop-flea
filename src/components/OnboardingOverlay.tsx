import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingWelcomeDialog from './OnboardingWelcomeDialog';
import OnboardingSpotlight from './OnboardingSpotlight';
import OnboardingComplete from './OnboardingComplete';

const OnboardingOverlay = () => {
  const { currentStep } = useOnboarding();

  if (!currentStep) return null;

  return (
    <>
      <OnboardingWelcomeDialog />
      <OnboardingSpotlight />
      <OnboardingComplete />
    </>
  );
};

export default OnboardingOverlay;

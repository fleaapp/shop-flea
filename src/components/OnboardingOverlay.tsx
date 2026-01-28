import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingWelcomeDialog from './OnboardingWelcomeDialog';
import OnboardingSpotlight from './OnboardingSpotlight';
import OnboardingComplete from './OnboardingComplete';

const OnboardingOverlay = () => {
  const { currentStep, skipOnboarding } = useOnboarding();

  if (!currentStep) return null;

  // Only show spotlight for steps that are not welcome or complete
  const showSpotlight = currentStep !== 'welcome' && currentStep !== 'complete';

  const handleComplete = () => {
    skipOnboarding(); // This marks onboarding as complete
  };

  return (
    <>
      <OnboardingWelcomeDialog />
      {showSpotlight && (
        <OnboardingSpotlight 
          onComplete={handleComplete} 
          onSkip={skipOnboarding} 
        />
      )}
      <OnboardingComplete />
    </>
  );
};

export default OnboardingOverlay;

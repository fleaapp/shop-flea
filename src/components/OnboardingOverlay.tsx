import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingWelcomeDialog from './OnboardingWelcomeDialog';
import OnboardingHighlight from './OnboardingHighlight';
import OnboardingComplete from './OnboardingComplete';

const OnboardingOverlay = () => {
  const { currentStep } = useOnboarding();

  if (!currentStep) return null;

  return (
    <>
      <OnboardingWelcomeDialog />
      <OnboardingHighlight />
      <OnboardingComplete />
    </>
  );
};

export default OnboardingOverlay;

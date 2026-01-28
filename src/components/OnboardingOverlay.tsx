import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingWelcomeDialog from './OnboardingWelcomeDialog';

const OnboardingOverlay = () => {
  const { currentStep } = useOnboarding();

  if (!currentStep) return null;

  // Only show the welcome dialog - no spotlight tour for now
  return <OnboardingWelcomeDialog />;
};

export default OnboardingOverlay;

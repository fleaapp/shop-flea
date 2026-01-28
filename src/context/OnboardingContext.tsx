import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type OnboardingStep = 
  | 'swipe-navigation'
  | 'tap-to-expand'
  | 'navigation-bar'
  | 'cart-swipe'
  | 'orders-location'
  | 'sales-location'
  | 'notifications-location'
  | 'help-center'
  | 'add-listings'
  | 'refresh-listings'
  | 'edit-profile'
  | 'complete';

interface OnboardingContextValue {
  currentStep: OnboardingStep | null;
  isOnboardingActive: boolean;
  hasCompletedOnboarding: boolean;
  startOnboarding: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  goToStep: (step: OnboardingStep) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const ONBOARDING_STEPS: OnboardingStep[] = [
  'swipe-navigation',
  'tap-to-expand',
  'navigation-bar',
  'cart-swipe',
  'orders-location',
  'sales-location',
  'notifications-location',
  'help-center',
  'add-listings',
  'refresh-listings',
  'edit-profile',
  'complete',
];

const STORAGE_KEY = 'flea-onboarding-completed';

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    setHasCompletedOnboarding(completed === 'true');
  }, []);

  const startOnboarding = () => {
    setCurrentStep('swipe-navigation');
  };

  const nextStep = () => {
    if (!currentStep) return;
    
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex === -1 || currentIndex >= ONBOARDING_STEPS.length - 1) {
      setCurrentStep(null);
      setHasCompletedOnboarding(true);
      localStorage.setItem(STORAGE_KEY, 'true');
      return;
    }
    
    setCurrentStep(ONBOARDING_STEPS[currentIndex + 1]);
  };

  const skipOnboarding = () => {
    setCurrentStep(null);
    setHasCompletedOnboarding(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHasCompletedOnboarding(false);
    setCurrentStep(null);
  };

  const goToStep = (step: OnboardingStep) => {
    setCurrentStep(step);
  };

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        isOnboardingActive: currentStep !== null && currentStep !== 'complete',
        hasCompletedOnboarding,
        startOnboarding,
        nextStep,
        skipOnboarding,
        resetOnboarding,
        goToStep,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

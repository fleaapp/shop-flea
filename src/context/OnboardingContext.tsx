import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type OnboardingStep = 
  | 'welcome'
  | 'swipe-navigation'
  | 'tap-to-expand'
  | 'navigation-bar'
  | 'cart-swipe'
  | 'wishlist-location'
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
  isNewUser: boolean;
  startOnboarding: () => void;
  startTour: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  goToStep: (step: OnboardingStep) => void;
  markUserAsOnboarded: () => void;
  checkAndTriggerOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'swipe-navigation',
  'tap-to-expand',
  'navigation-bar',
  'cart-swipe',
  'wishlist-location',
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
const NEW_USER_KEY = 'flea-new-user-pending-onboarding';

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    const pendingOnboarding = localStorage.getItem(NEW_USER_KEY);
    
    setHasCompletedOnboarding(completed === 'true');
    setIsNewUser(pendingOnboarding === 'true');
  }, []);

  // Shows the welcome dialog
  const startOnboarding = useCallback(() => {
    setCurrentStep('welcome');
    // Clear the new user flag once onboarding starts
    localStorage.removeItem(NEW_USER_KEY);
    setIsNewUser(false);
  }, []);

  // Called when user clicks "Take Tour" - starts the actual tour
  const startTour = useCallback(() => {
    setCurrentStep('swipe-navigation');
  }, []);

  // Called from Index page to check if we should start onboarding
  const checkAndTriggerOnboarding = useCallback(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    const pendingOnboarding = localStorage.getItem(NEW_USER_KEY);
    
    console.log('[Onboarding] Checking trigger:', { completed, pendingOnboarding });
    
    if (pendingOnboarding === 'true' && completed !== 'true') {
      console.log('[Onboarding] Starting onboarding in 500ms...');
      // Small delay to let the page render first
      setTimeout(() => {
        console.log('[Onboarding] Triggering welcome dialog now');
        startOnboarding();
      }, 500);
    }
  }, [startOnboarding]);

  // Called after signup to mark user for onboarding
  const markUserAsOnboarded = useCallback(() => {
    console.log('[Onboarding] Setting new user flag in localStorage');
    localStorage.setItem(NEW_USER_KEY, 'true');
    setIsNewUser(true);
  }, []);

  const nextStep = useCallback(() => {
    if (!currentStep) return;
    
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex === -1 || currentIndex >= ONBOARDING_STEPS.length - 1) {
      setCurrentStep(null);
      setHasCompletedOnboarding(true);
      localStorage.setItem(STORAGE_KEY, 'true');
      return;
    }
    
    setCurrentStep(ONBOARDING_STEPS[currentIndex + 1]);
  }, [currentStep]);

  const skipOnboarding = useCallback(() => {
    setCurrentStep(null);
    setHasCompletedOnboarding(true);
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.removeItem(NEW_USER_KEY);
    setIsNewUser(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NEW_USER_KEY);
    setHasCompletedOnboarding(false);
    setIsNewUser(false);
    setCurrentStep(null);
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        isOnboardingActive: currentStep !== null && currentStep !== 'complete',
        hasCompletedOnboarding,
        isNewUser,
        startOnboarding,
        startTour,
        nextStep,
        skipOnboarding,
        resetOnboarding,
        goToStep,
        markUserAsOnboarded,
        checkAndTriggerOnboarding,
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

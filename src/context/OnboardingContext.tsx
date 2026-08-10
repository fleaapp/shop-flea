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
  showCarousel: boolean;
  walkthroughDone: boolean;
  /**
   * Increments every time the walkthrough is finished or skipped. Callers that
   * need to react to "this walkthrough just ended" compare against the value
   * they saw when they opened it, so a completion from an earlier session can
   * never be mistaken for the current one.
   */
  walkthroughCompletionCount: number;
  /** True while a signup dialog (username / password) is open. Blocks the walkthrough. */
  signupDialogOpen: boolean;
  setSignupDialogOpen: (open: boolean) => void;
  openCarousel: () => void;
  closeCarousel: () => void;
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
  const [showCarousel, setShowCarousel] = useState(false);
  // True once the walkthrough has been finished or skipped in this session.
  const [walkthroughDone, setWalkthroughDone] = useState(false);
  const [walkthroughCompletionCount, setWalkthroughCompletionCount] = useState(0);
  // Signup dialogs (username / password) own the screen exclusively.
  const [signupDialogOpen, setSignupDialogOpenState] = useState(false);

  const markWalkthroughComplete = useCallback(() => {
    setWalkthroughDone(true);
    setWalkthroughCompletionCount((n) => n + 1);
  }, []);

  const openCarousel = useCallback(() => {
    setWalkthroughDone(false);
    setShowCarousel(true);
  }, []);
  const closeCarousel = useCallback(() => {
    setShowCarousel(false);
    markWalkthroughComplete();
  }, [markWalkthroughComplete]);

  // A signup dialog owns the screen exclusively: opening one closes any
  // onboarding surface synchronously so the two can never overlap.
  const setSignupDialogOpen = useCallback((open: boolean) => {
    setSignupDialogOpenState(open);
    if (open) {
      setShowCarousel(false);
      setCurrentStep(null);
    }
  }, []);


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

  // Called when user clicks "Take Tour" - opens the walkthrough carousel
  const startTour = useCallback(() => {
    setCurrentStep(null);
    setShowCarousel(true);
  }, []);

  // Called from Index page to check if we should start onboarding
  const checkAndTriggerOnboarding = useCallback(() => {
    const pendingOnboarding = localStorage.getItem(NEW_USER_KEY);

    // If a user just signed up, always show onboarding even if this device previously completed it.
    if (pendingOnboarding === 'true') {
      // Small delay to let the page render first
      setTimeout(() => {
        startOnboarding();
      }, 500);
    }
  }, [startOnboarding]);

  // Called after signup to mark user for onboarding
  const markUserAsOnboarded = useCallback(() => {
    // Ensure a fresh signup always gets the tour, even if onboarding was completed earlier on this device.
    localStorage.removeItem(STORAGE_KEY);
    setHasCompletedOnboarding(false);
    localStorage.setItem(NEW_USER_KEY, 'true');
    setIsNewUser(true);
  }, []);

  const nextStep = useCallback(() => {
    if (!currentStep) return;
    
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex === -1 || currentIndex >= ONBOARDING_STEPS.length - 1) {
      setCurrentStep(null);
      setHasCompletedOnboarding(true);
      markWalkthroughComplete();
      localStorage.setItem(STORAGE_KEY, 'true');
      return;
    }
    
    setCurrentStep(ONBOARDING_STEPS[currentIndex + 1]);
  }, [currentStep, markWalkthroughComplete]);

  const skipOnboarding = useCallback(() => {
    markWalkthroughComplete();
    setCurrentStep(null);
    setHasCompletedOnboarding(true);
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.removeItem(NEW_USER_KEY);
    setIsNewUser(false);
  }, [markWalkthroughComplete]);


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
         showCarousel,
         walkthroughDone,
         walkthroughCompletionCount,

         signupDialogOpen,
         setSignupDialogOpen,
         openCarousel,
         closeCarousel,
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

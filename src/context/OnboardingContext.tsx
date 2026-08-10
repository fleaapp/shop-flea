import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { sendWelcomeNotification } from '@/utils/welcomeNotification';

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

export type SignupFlowStage = 'profile' | 'password' | 'walkthrough' | 'welcome' | null;

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
  signupFlowStage: SignupFlowStage;
  setSignupDialogOpen: (open: boolean) => void;
  setSignupFlowStage: (stage: SignupFlowStage) => void;
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
const signupFlowKey = (userId: string) => `flea_signup_flow_${userId}`;

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  // True once the walkthrough has been finished or skipped in this session.
  const [walkthroughDone, setWalkthroughDone] = useState(false);
  const [walkthroughCompletionCount, setWalkthroughCompletionCount] = useState(0);
  // Signup dialogs (username / password) own the screen exclusively.
  const [signupDialogOpen, setSignupDialogOpenState] = useState(false);
  const [signupFlowStage, setSignupFlowStageState] = useState<SignupFlowStage>(null);

  const setSignupFlowStage = useCallback((stage: SignupFlowStage) => {
    setSignupFlowStageState(stage);
    if (!user) return;
    const key = signupFlowKey(user.id);
    if (stage) localStorage.setItem(key, stage);
    else localStorage.removeItem(key);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSignupFlowStageState(null);
      return;
    }
    const saved = localStorage.getItem(signupFlowKey(user.id));
    const validStages: SignupFlowStage[] = ['profile', 'password', 'walkthrough', 'welcome'];
    setSignupFlowStageState(validStages.includes(saved as SignupFlowStage) ? saved as SignupFlowStage : null);
  }, [user?.id]);

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
    if (!user || signupFlowStage !== 'walkthrough') return;

    // Persist the final stage before the request. If the app is interrupted,
    // mounting again retries the idempotent backend call rather than losing it.
    localStorage.setItem(signupFlowKey(user.id), 'welcome');
    setSignupFlowStageState('welcome');
    void sendWelcomeNotification().finally(() => {
      localStorage.setItem(`flea_welcome_notified_${user.id}`, '1');
      localStorage.removeItem(signupFlowKey(user.id));
      localStorage.removeItem(NEW_USER_KEY);
      setSignupFlowStageState(null);
      setIsNewUser(false);
    });
  }, [markWalkthroughComplete, signupFlowStage, user]);

  // A signup dialog owns the screen exclusively: opening one closes any
  // onboarding surface synchronously so the two can never overlap.
  const setSignupDialogOpen = useCallback((open: boolean) => {
    setSignupDialogOpenState(open);
    if (open) {
      setShowCarousel(false);
      setCurrentStep(null);
    }
  }, []);

  // A persisted walkthrough stage is authoritative. Open only after the
  // profile/password dialog has actually released the screen.
  useEffect(() => {
    if (signupFlowStage !== 'walkthrough' || signupDialogOpen || showCarousel) return;
    const frame = requestAnimationFrame(() => {
      setWalkthroughDone(false);
      setShowCarousel(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [signupFlowStage, signupDialogOpen, showCarousel]);

  // Resume a welcome request interrupted by navigation/backgrounding.
  useEffect(() => {
    if (!user || signupFlowStage !== 'welcome') return;
    let cancelled = false;
    void sendWelcomeNotification().finally(() => {
      if (cancelled) return;
      localStorage.setItem(`flea_welcome_notified_${user.id}`, '1');
      localStorage.removeItem(signupFlowKey(user.id));
      localStorage.removeItem(NEW_USER_KEY);
      setSignupFlowStageState(null);
      setIsNewUser(false);
    });
    return () => { cancelled = true; };
  }, [signupFlowStage, user]);


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
         signupFlowStage,
         setSignupDialogOpen,
         setSignupFlowStage,
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

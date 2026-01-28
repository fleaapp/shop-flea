import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingTooltip from './OnboardingTooltip';
import { cn } from '@/lib/utils';

const OnboardingOverlay = () => {
  const { currentStep, isOnboardingActive, skipOnboarding } = useOnboarding();

  if (!isOnboardingActive && currentStep !== 'complete') return null;

  // Steps that show as centered overlay
  const centeredSteps = [
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

  const isCentered = currentStep && centeredSteps.includes(currentStep);

  return (
    <AnimatePresence>
      {(isOnboardingActive || currentStep === 'complete') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99] flex items-center justify-center"
          onClick={(e) => {
            // Only skip if clicking the backdrop
            if (e.target === e.currentTarget) {
              skipOnboarding();
            }
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" />
          
          {/* Centered tooltip */}
          {isCentered && currentStep && (
            <div className="relative">
              <OnboardingTooltip 
                step={currentStep} 
                position="center"
                className="relative translate-x-0 translate-y-0 top-0 left-0"
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingOverlay;

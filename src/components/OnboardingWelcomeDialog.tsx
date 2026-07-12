import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/context/OnboardingContext';
import { pushOverlayAppChrome } from '@/lib/appChrome';
import { useEffect } from 'react';

const OnboardingWelcomeDialog = () => {
  const { currentStep, startTour, skipOnboarding } = useOnboarding();

  useEffect(() => {
    if (currentStep !== 'welcome') return;
    return pushOverlayAppChrome();
  }, [currentStep]);

  if (currentStep !== 'welcome') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-foreground/50" />
        
        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative bg-card rounded-3xl p-8 mx-6 max-w-sm w-full card-shadow border border-border"
        >
          {/* Welcome Text */}
          <div className="text-center mb-8">
            <p className="text-3xl mb-5">👉👟👗🧢</p>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              First time on Flea?
            </h2>
            <p className="text-muted-foreground">
              Take a quick tour to discover how to sell, save & buy your next great find on Flea.
            </p>
          </div>
          
          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={startTour}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-semibold rounded-xl"
            >
              Take the Tour
            </Button>
            <Button
              variant="ghost"
              onClick={skipOnboarding}
              className="w-full text-muted-foreground hover:text-foreground h-10"
            >
              Skip for now
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingWelcomeDialog;

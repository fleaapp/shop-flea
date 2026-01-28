import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/context/OnboardingContext';
import fleaLogo from '@/assets/flea-logo.png';

const OnboardingWelcomeDialog = () => {
  const { currentStep, startTour, skipOnboarding } = useOnboarding();

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
        <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" />
        
        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative bg-card rounded-3xl p-8 mx-6 max-w-sm w-full card-shadow border border-border"
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={fleaLogo} alt="FLEA" className="h-12 w-auto" />
          </div>
          
          {/* Welcome Text */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Welcome to FLEA! 🎉
            </h2>
            <p className="text-muted-foreground">
              Let's take a quick tour to show you how to browse, buy, and sell on FLEA.
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

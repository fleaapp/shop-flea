import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/context/OnboardingContext';

const OnboardingComplete = () => {
  const { currentStep, skipOnboarding } = useOnboarding();

  if (currentStep !== 'complete') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        onClick={skipOnboarding}
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
          onClick={(e) => e.stopPropagation()}
        >
          {/* Celebration emoji */}
          <div className="text-6xl mb-4 text-center">🎉</div>
          
          {/* Complete Text */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              You're All Set!
            </h2>
            <p className="text-muted-foreground">
              Enjoy shopping on FLEA! Start swiping to discover unique finds.
            </p>
          </div>
          
          {/* Button */}
          <Button
            onClick={skipOnboarding}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-semibold rounded-xl"
          >
            Get Started
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingComplete;

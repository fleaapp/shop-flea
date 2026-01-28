import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/context/OnboardingContext';
import fleaLogo from '@/assets/flea-logo.png';

const OnboardingStartDialog = () => {
  const { hasCompletedOnboarding, startOnboarding, skipOnboarding } = useOnboarding();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show dialog after a brief delay for new users
    if (!hasCompletedOnboarding) {
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding]);

  if (!show || hasCompletedOnboarding) return null;

  const handleStart = () => {
    setShow(false);
    startOnboarding();
  };

  const handleSkip = () => {
    setShow(false);
    skipOnboarding();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-sm" />
        
        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative bg-card rounded-3xl p-8 max-w-[320px] w-full card-shadow"
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={fleaLogo} alt="FLEA" className="h-12" />
          </div>
          
          {/* Welcome message */}
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">
            Welcome to FLEA! 👋
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            The thrift marketplace where you can buy and sell second-hand fashion with a simple swipe.
          </p>
          
          {/* Features preview */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-xl">👈</span>
              <span className="text-foreground">Swipe left to pass</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-xl">👉</span>
              <span className="text-foreground">Swipe right to save</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-xl">👆</span>
              <span className="text-foreground">Swipe up to add to cart</span>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleStart}
              className="w-full bg-charcoal text-white hover:bg-charcoal-light h-12 rounded-xl font-semibold"
            >
              Take the Tour
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full text-muted-foreground hover:text-foreground h-10"
            >
              I'll explore on my own
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingStartDialog;

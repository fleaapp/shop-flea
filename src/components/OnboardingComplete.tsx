import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/context/OnboardingContext';
import { pushOverlayAppChrome } from '@/lib/appChrome';
import { useEffect, useState } from 'react';
import PushPermissionSheet from '@/components/PushPermissionSheet';
import { shouldShowPushPrompt } from '@/lib/pushPrompt';
import { useAuth } from '@/context/AuthContext';

const OnboardingComplete = () => {
  const { currentStep, skipOnboarding } = useOnboarding();
  const { user } = useAuth();
  const [showPushSheet, setShowPushSheet] = useState(false);

  useEffect(() => {
    if (currentStep !== 'complete') return;
    return pushOverlayAppChrome();
  }, [currentStep]);

  const handleFinish = () => {
    // Close the celebratory overlay first so the push sheet gets full focus.
    skipOnboarding();
    if (shouldShowPushPrompt(user?.id, 'buyer_onboarding')) {
      // Small delay so the celebratory overlay finishes its exit animation.
      setTimeout(() => setShowPushSheet(true), 250);
    }
  };

  if (currentStep !== 'complete' && !showPushSheet) return null;

  return (
    <>
      <AnimatePresence>
        {currentStep === 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={handleFinish}
          >
            <div className="absolute inset-0 bg-foreground/50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative bg-card rounded-3xl p-8 mx-6 max-w-sm w-full card-shadow border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-6xl mb-4 text-center">🎉</div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  You're All Set!
                </h2>
                <p className="text-muted-foreground">
                  Enjoy shopping on FLEA! Start swiping to discover unique finds.
                </p>
              </div>
              <Button
                onClick={handleFinish}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-semibold rounded-xl"
              >
                Get Started
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PushPermissionSheet
        open={showPushSheet}
        onOpenChange={setShowPushSheet}
        source="buyer_onboarding"
      />
    </>
  );
};

export default OnboardingComplete;

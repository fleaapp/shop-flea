import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding, OnboardingStep } from '@/context/OnboardingContext';
import { cn } from '@/lib/utils';

interface TooltipContent {
  title: string;
  description: string;
  emoji?: string;
}

const TOOLTIP_CONTENT: Record<OnboardingStep, TooltipContent> = {
  'swipe-navigation': {
    title: 'Swipe to Browse',
    description: 'Swipe left to pass, right to add to Wishlist, up to add to Cart!',
    emoji: '👆',
  },
  'tap-to-expand': {
    title: 'Tap for Details',
    description: 'Tap any listing to see full details, photos, and seller info.',
    emoji: '👀',
  },
  'navigation-bar': {
    title: 'Navigate Easily',
    description: 'Use the bottom bar: Settings, Profile, Home, Cart, and Alerts.',
    emoji: '🧭',
  },
  'cart-swipe': {
    title: 'Manage Your Cart',
    description: 'Swipe left to remove items, swipe right to move to Wishlist.',
    emoji: '🛒',
  },
  'orders-location': {
    title: 'Track Orders',
    description: 'Find your orders in the Cart page → Orders tab.',
    emoji: '📦',
  },
  'sales-location': {
    title: 'View Your Sales',
    description: 'Check your sales in Alerts → Sales tab.',
    emoji: '💰',
  },
  'notifications-location': {
    title: 'Stay Updated',
    description: 'Tap the bell icon for likes, comments, and activity.',
    emoji: '🔔',
  },
  'help-center': {
    title: 'Need Help?',
    description: 'Find the Help Center in Settings for FAQs and support.',
    emoji: '❓',
  },
  'add-listings': {
    title: 'Start Selling',
    description: 'Create listings from your Profile page with the + button.',
    emoji: '📸',
  },
  'refresh-listings': {
    title: 'Undo Actions',
    description: 'Use the ↩️ button to undo your last swipe action.',
    emoji: '↩️',
  },
  'edit-profile': {
    title: 'Personalize',
    description: 'Edit your profile in Settings → Profile.',
    emoji: '✏️',
  },
  'complete': {
    title: "You're All Set!",
    description: 'Enjoy shopping on FLEA! Tap anywhere to start.',
    emoji: '🎉',
  },
};

interface OnboardingTooltipProps {
  step: OnboardingStep;
  position?: 'top' | 'bottom' | 'center';
  arrowPosition?: 'left' | 'center' | 'right' | 'none';
  className?: string;
}

const OnboardingTooltip = ({ 
  step, 
  position = 'center',
  arrowPosition = 'none',
  className 
}: OnboardingTooltipProps) => {
  const { currentStep, nextStep, skipOnboarding } = useOnboarding();
  
  if (currentStep !== step) return null;

  const content = TOOLTIP_CONTENT[step];
  const isComplete = step === 'complete';
  const stepIndex = Object.keys(TOOLTIP_CONTENT).indexOf(step);
  const totalSteps = Object.keys(TOOLTIP_CONTENT).length - 1; // Exclude 'complete'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? -10 : position === 'bottom' ? 10 : 0 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={cn(
          'absolute z-[100] w-[280px] max-w-[85vw]',
          position === 'top' && 'bottom-full mb-3',
          position === 'bottom' && 'top-full mt-3',
          position === 'center' && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          className
        )}
      >
        {/* Arrow */}
        {arrowPosition !== 'none' && (
          <div
            className={cn(
              'absolute w-4 h-4 bg-card rotate-45',
              position === 'top' && 'bottom-[-8px]',
              position === 'bottom' && 'top-[-8px]',
              arrowPosition === 'left' && 'left-8',
              arrowPosition === 'center' && 'left-1/2 -translate-x-1/2',
              arrowPosition === 'right' && 'right-8'
            )}
          />
        )}
        
        <div className="relative bg-card rounded-2xl p-5 card-shadow border border-border">
          {/* Emoji */}
          <div className="text-4xl mb-3 text-center">{content.emoji}</div>
          
          {/* Title */}
          <h3 className="text-lg font-bold text-foreground text-center mb-2">
            {content.title}
          </h3>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground text-center mb-4">
            {content.description}
          </p>
          
          {/* Progress dots */}
          {!isComplete && (
            <div className="flex justify-center gap-1.5 mb-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    i === stepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
          )}
          
          {/* Buttons */}
          <div className="flex gap-2">
            {!isComplete && (
              <Button
                variant="ghost"
                onClick={skipOnboarding}
                className="flex-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
            )}
            <Button
              onClick={nextStep}
              className={cn(
                'flex-1 bg-charcoal text-white hover:bg-charcoal-light',
                isComplete && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {isComplete ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingTooltip;

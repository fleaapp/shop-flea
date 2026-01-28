import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding, OnboardingStep } from '@/context/OnboardingContext';
import { ChevronUp, ChevronLeft, ChevronRight, ChevronDown, Hand, MousePointer2 } from 'lucide-react';

interface StepConfig {
  title: string;
  description: string;
  emoji?: string;
  position: 'top' | 'center' | 'bottom';
  arrows?: ('up' | 'down' | 'left' | 'right')[];
  showGesture?: 'swipe' | 'tap';
  pointerDirection?: 'up' | 'down' | 'left' | 'right';
}

const STEP_CONFIG: Record<Exclude<OnboardingStep, 'welcome' | 'complete'>, StepConfig> = {
  'swipe-navigation': {
    title: 'Swipe to Browse',
    description: 'Swipe left to pass, right to add to Wishlist, up to add to Cart!',
    emoji: '👆',
    position: 'bottom',
    arrows: ['left', 'right', 'up'],
    showGesture: 'swipe',
  },
  'tap-to-expand': {
    title: 'Tap for Details',
    description: 'Tap any listing card to see full details, photos, and seller info.',
    emoji: '👀',
    position: 'bottom',
    showGesture: 'tap',
    pointerDirection: 'up',
  },
  'navigation-bar': {
    title: 'Navigate Easily',
    description: 'Use the bottom bar to access Settings, Profile, Home, Cart, and Alerts.',
    emoji: '🧭',
    position: 'top',
    pointerDirection: 'down',
  },
  'cart-swipe': {
    title: 'Manage Your Cart',
    description: 'In Cart: Swipe left to remove items, swipe right to move to Wishlist.',
    emoji: '🛒',
    position: 'center',
    arrows: ['left', 'right'],
  },
  'wishlist-location': {
    title: 'Your Wishlist',
    description: 'Find your saved items by tapping your Profile → Wishlist tab.',
    emoji: '❤️',
    position: 'center',
  },
  'orders-location': {
    title: 'Track Orders',
    description: 'Find your orders in Cart → Orders tab.',
    emoji: '📦',
    position: 'center',
  },
  'sales-location': {
    title: 'View Your Sales',
    description: 'Check your sales in Alerts → Sales tab.',
    emoji: '💰',
    position: 'center',
  },
  'notifications-location': {
    title: 'Stay Updated',
    description: 'Tap Alerts in the nav bar for likes, comments, and activity.',
    emoji: '🔔',
    position: 'top',
    pointerDirection: 'down',
  },
  'help-center': {
    title: 'Need Help?',
    description: 'Find the Help Center in Settings for FAQs and support.',
    emoji: '❓',
    position: 'center',
  },
  'add-listings': {
    title: 'Start Selling',
    description: 'Create listings from your Profile page using the + button.',
    emoji: '📸',
    position: 'center',
  },
  'refresh-listings': {
    title: 'Undo Actions',
    description: 'Use the ↩️ button in the header to undo your last swipe.',
    emoji: '↩️',
    position: 'bottom',
    pointerDirection: 'up',
  },
  'edit-profile': {
    title: 'Personalize',
    description: 'Edit your profile in Settings → Profile.',
    emoji: '✏️',
    position: 'center',
  },
};

// Animated arrow component
const AnimatedArrow = ({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) => {
  const ArrowIcon = {
    up: ChevronUp,
    down: ChevronDown,
    left: ChevronLeft,
    right: ChevronRight,
  }[direction];

  const animationVariants = {
    up: { y: [0, -12, 0] },
    down: { y: [0, 12, 0] },
    left: { x: [0, -12, 0] },
    right: { x: [0, 12, 0] },
  };

  return (
    <motion.div
      animate={animationVariants[direction]}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className="text-primary"
    >
      <ArrowIcon className="w-8 h-8" strokeWidth={3} />
    </motion.div>
  );
};

// Animated pointing indicator
const PointingIndicator = ({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) => {
  const rotation = {
    up: 0,
    down: 180,
    left: -90,
    right: 90,
  }[direction];

  const animationVariants = {
    up: { y: [0, -8, 0] },
    down: { y: [0, 8, 0] },
    left: { x: [0, -8, 0] },
    right: { x: [0, 8, 0] },
  };

  return (
    <motion.div
      animate={animationVariants[direction]}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className="absolute"
      style={{
        [direction === 'up' ? 'bottom' : direction === 'down' ? 'top' : direction === 'left' ? 'right' : 'left']: '100%',
        ...(direction === 'up' || direction === 'down' ? { left: '50%', transform: `translateX(-50%) rotate(${rotation}deg)` } : { top: '50%', transform: `translateY(-50%) rotate(${rotation}deg)` }),
      }}
    >
      <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[16px] border-b-primary" />
    </motion.div>
  );
};

// Tap gesture animation
const TapGesture = () => (
  <motion.div
    className="relative"
    initial={{ scale: 1, opacity: 0.8 }}
    animate={{ scale: [1, 0.9, 1], opacity: [0.8, 1, 0.8] }}
    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
  >
    <MousePointer2 className="w-10 h-10 text-primary" />
    <motion.div
      className="absolute inset-0 rounded-full bg-primary/30"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: [0.8, 1.5], opacity: [0.5, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
    />
  </motion.div>
);

// Swipe gesture animation
const SwipeGesture = () => (
  <div className="flex items-center gap-6">
    <motion.div
      className="flex items-center gap-2"
      animate={{ x: [-5, 5, -5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Hand className="w-8 h-8 text-primary" />
    </motion.div>
  </div>
);

const OnboardingHighlight = () => {
  const { currentStep, nextStep, skipOnboarding } = useOnboarding();
  
  // Don't show for welcome or complete steps
  if (!currentStep || currentStep === 'welcome' || currentStep === 'complete') return null;

  const config = STEP_CONFIG[currentStep];
  const stepKeys = Object.keys(STEP_CONFIG);
  const stepIndex = stepKeys.indexOf(currentStep);
  const totalSteps = stepKeys.length;

  const getPositionClasses = () => {
    switch (config.position) {
      case 'top':
        return 'top-24';
      case 'bottom':
        return 'bottom-28';
      case 'center':
      default:
        return 'top-1/2 -translate-y-1/2';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            skipOnboarding();
          }
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-[2px]" />
        
        {/* Content card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`absolute left-4 right-4 mx-auto max-w-sm ${getPositionClasses()}`}
        >
          <div className="relative bg-card rounded-2xl p-6 card-shadow border border-border">
            {/* Pointing indicator */}
            {config.pointerDirection && (
              <PointingIndicator direction={config.pointerDirection} />
            )}
            
            {/* Gesture animations */}
            {config.showGesture && (
              <div className="flex justify-center mb-4">
                {config.showGesture === 'swipe' ? <SwipeGesture /> : <TapGesture />}
              </div>
            )}
            
            {/* Swipe arrows */}
            {config.arrows && config.arrows.length > 0 && (
              <div className="flex justify-center items-center gap-6 mb-4">
                {config.arrows.map((dir, i) => (
                  <AnimatedArrow key={i} direction={dir} />
                ))}
              </div>
            )}
            
            {/* Emoji */}
            <div className="text-4xl mb-3 text-center">{config.emoji}</div>
            
            {/* Title */}
            <h3 className="text-xl font-bold text-foreground text-center mb-2">
              {config.title}
            </h3>
            
            {/* Description */}
            <p className="text-sm text-muted-foreground text-center mb-5">
              {config.description}
            </p>
            
            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mb-5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === stepIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={skipOnboarding}
                className="flex-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
              <Button
                onClick={nextStep}
                className="flex-1 bg-charcoal text-white hover:bg-charcoal/90"
              >
                Next
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingHighlight;

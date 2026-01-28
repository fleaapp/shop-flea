import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding, OnboardingStep } from '@/context/OnboardingContext';
import { ChevronUp, ChevronLeft, ChevronRight, Hand } from 'lucide-react';

interface StepConfig {
  targetId: string;
  title: string;
  description: string;
  tooltipPosition: 'top' | 'bottom' | 'left' | 'right';
  arrowDirection: 'up' | 'down' | 'left' | 'right';
  showGestures?: ('left' | 'right' | 'up')[];
  padding?: number;
}

const STEP_CONFIG: Record<Exclude<OnboardingStep, 'welcome' | 'complete'>, StepConfig> = {
  'swipe-navigation': {
    targetId: 'swipe-card-stack',
    title: 'Swipe to Browse',
    description: 'Swipe left to pass, right to add to Wishlist, up to add to Cart!',
    tooltipPosition: 'bottom',
    arrowDirection: 'up',
    showGestures: ['left', 'right', 'up'],
    padding: 16,
  },
  'tap-to-expand': {
    targetId: 'swipe-card-stack',
    title: 'Tap for Details',
    description: 'Tap any listing to see full details, photos, and seller info.',
    tooltipPosition: 'bottom',
    arrowDirection: 'up',
    padding: 16,
  },
  'navigation-bar': {
    targetId: 'bottom-nav',
    title: 'Navigate the App',
    description: 'Settings, Profile, Home, Cart, and Alerts — all here!',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 8,
  },
  'cart-swipe': {
    targetId: 'nav-cart',
    title: 'Manage Your Cart',
    description: 'In Cart: swipe left to remove, swipe right to move to Wishlist.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
  'wishlist-location': {
    targetId: 'nav-profile',
    title: 'Your Wishlist',
    description: 'Find saved items in Profile → Wishlist tab.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
  'orders-location': {
    targetId: 'nav-cart',
    title: 'Track Orders',
    description: 'Find your orders in Cart → Orders tab.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
  'sales-location': {
    targetId: 'nav-alerts',
    title: 'View Your Sales',
    description: 'Check your sales in Alerts → Sales tab.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
  'notifications-location': {
    targetId: 'nav-alerts',
    title: 'Stay Updated',
    description: 'Likes, comments, and activity notifications live here.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
  'help-center': {
    targetId: 'nav-settings',
    title: 'Need Help?',
    description: 'Find FAQs and support in Settings → Help Center.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
  'add-listings': {
    targetId: 'nav-profile',
    title: 'Start Selling',
    description: 'Create listings from Profile using the + button.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
  'refresh-listings': {
    targetId: 'undo-button',
    title: 'Undo Actions',
    description: 'Changed your mind? Tap here to undo your last swipe.',
    tooltipPosition: 'bottom',
    arrowDirection: 'up',
    padding: 8,
  },
  'edit-profile': {
    targetId: 'nav-settings',
    title: 'Personalize',
    description: 'Edit your profile in Settings → Profile.',
    tooltipPosition: 'top',
    arrowDirection: 'down',
    padding: 4,
  },
};

// Gesture indicators for swipe step
const SwipeGestureIndicators = () => (
  <div className="flex items-center justify-center gap-8 mb-4">
    <motion.div
      className="flex flex-col items-center gap-1"
      animate={{ x: [-8, 0, -8] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <ChevronLeft className="w-8 h-8 text-destructive" strokeWidth={3} />
      <span className="text-xs text-destructive font-medium">Pass</span>
    </motion.div>
    
    <motion.div
      className="flex flex-col items-center gap-1"
      animate={{ y: [-8, 0, -8] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <ChevronUp className="w-8 h-8 text-primary" strokeWidth={3} />
      <span className="text-xs text-primary font-medium">Cart</span>
    </motion.div>
    
    <motion.div
      className="flex flex-col items-center gap-1"
      animate={{ x: [8, 0, 8] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <ChevronRight className="w-8 h-8 text-green-500" strokeWidth={3} />
      <span className="text-xs text-green-500 font-medium">Wishlist</span>
    </motion.div>
  </div>
);

// Long arrow pointing to element
const PointingArrow = ({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) => {
  const isVertical = direction === 'up' || direction === 'down';
  const isReverse = direction === 'down' || direction === 'right';
  
  return (
    <motion.div
      className={`flex ${isVertical ? 'flex-col' : 'flex-row'} items-center ${isReverse ? (isVertical ? 'flex-col-reverse' : 'flex-row-reverse') : ''}`}
      animate={
        isVertical 
          ? { y: isReverse ? [0, 8, 0] : [0, -8, 0] }
          : { x: isReverse ? [0, 8, 0] : [0, -8, 0] }
      }
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Arrow line */}
      <div 
        className={`bg-primary ${isVertical ? 'w-1 h-12' : 'h-1 w-12'} rounded-full`}
      />
      {/* Arrow head */}
      <div 
        className={`w-0 h-0 ${
          direction === 'up' ? 'border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-primary' :
          direction === 'down' ? 'border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-primary' :
          direction === 'left' ? 'border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[12px] border-r-primary' :
          'border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[12px] border-l-primary'
        }`}
      />
    </motion.div>
  );
};

const OnboardingSpotlight = () => {
  const { currentStep, nextStep, skipOnboarding } = useOnboarding();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  const updateTargetRect = useCallback(() => {
    if (!currentStep || currentStep === 'welcome' || currentStep === 'complete') {
      setTargetRect(null);
      return;
    }
    
    const config = STEP_CONFIG[currentStep];
    if (!config) return;
    
    const element = document.querySelector(`[data-onboarding="${config.targetId}"]`);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    }
  }, [currentStep]);
  
  useEffect(() => {
    updateTargetRect();
    
    // Update on resize/scroll
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    
    // Also update after a small delay to catch late-rendering elements
    const timeout = setTimeout(updateTargetRect, 100);
    
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
      clearTimeout(timeout);
    };
  }, [updateTargetRect]);
  
  if (!currentStep || currentStep === 'welcome' || currentStep === 'complete' || !targetRect) {
    return null;
  }
  
  const config = STEP_CONFIG[currentStep];
  const padding = config.padding || 8;
  const stepKeys = Object.keys(STEP_CONFIG);
  const stepIndex = stepKeys.indexOf(currentStep);
  const totalSteps = stepKeys.length;
  
  // Calculate spotlight cutout dimensions
  const spotlightX = targetRect.left - padding;
  const spotlightY = targetRect.top - padding;
  const spotlightWidth = targetRect.width + padding * 2;
  const spotlightHeight = targetRect.height + padding * 2;
  
  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    const gap = 24; // Gap between spotlight and tooltip
    
    switch (config.tooltipPosition) {
      case 'top':
        return {
          bottom: window.innerHeight - spotlightY + gap,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: spotlightY + spotlightHeight + gap,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          right: window.innerWidth - spotlightX + gap,
          top: spotlightY + spotlightHeight / 2,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          left: spotlightX + spotlightWidth + gap,
          top: spotlightY + spotlightHeight / 2,
          transform: 'translateY(-50%)',
        };
    }
  };
  
  // Calculate arrow position (between tooltip and spotlight)
  const getArrowStyle = (): React.CSSProperties => {
    const arrowGap = 4;
    
    switch (config.arrowDirection) {
      case 'up':
        return {
          bottom: window.innerHeight - spotlightY + arrowGap,
          left: spotlightX + spotlightWidth / 2,
          transform: 'translateX(-50%)',
        };
      case 'down':
        return {
          top: spotlightY + spotlightHeight + arrowGap,
          left: spotlightX + spotlightWidth / 2,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          right: window.innerWidth - spotlightX + arrowGap,
          top: spotlightY + spotlightHeight / 2,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          left: spotlightX + spotlightWidth + arrowGap,
          top: spotlightY + spotlightHeight / 2,
          transform: 'translateY(-50%)',
        };
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] pointer-events-auto"
      >
        {/* SVG mask for spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              {/* White = visible (dark overlay) */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black = transparent (cutout hole) */}
              <rect
                x={spotlightX}
                y={spotlightY}
                width={spotlightWidth}
                height={spotlightHeight}
                rx="16"
                fill="black"
              />
            </mask>
          </defs>
          {/* Dark overlay with cutout */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(30, 30, 30, 0.85)"
            mask="url(#spotlight-mask)"
          />
        </svg>
        
        {/* Spotlight border glow */}
        <motion.div
          className="absolute rounded-2xl border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]"
          style={{
            left: spotlightX,
            top: spotlightY,
            width: spotlightWidth,
            height: spotlightHeight,
          }}
          animate={{
            boxShadow: [
              '0 0 20px 0px hsl(var(--primary) / 0.4)',
              '0 0 30px 4px hsl(var(--primary) / 0.6)',
              '0 0 20px 0px hsl(var(--primary) / 0.4)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Arrow pointing to element */}
        <div className="absolute" style={getArrowStyle()}>
          <PointingArrow direction={config.arrowDirection} />
        </div>
        
        {/* Tooltip card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
          className="absolute w-[280px] max-w-[85vw]"
          style={getTooltipStyle()}
        >
          <div className="bg-card rounded-2xl p-5 card-shadow border border-border">
            {/* Gesture indicators for swipe step */}
            {config.showGestures && <SwipeGestureIndicators />}
            
            {/* Title */}
            <h3 className="text-lg font-bold text-foreground text-center mb-2">
              {config.title}
            </h3>
            
            {/* Description */}
            <p className="text-sm text-muted-foreground text-center mb-4">
              {config.description}
            </p>
            
            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mb-4">
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

export default OnboardingSpotlight;

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ONBOARDING_STEPS, STEP_ORDER, OnboardingStepKey } from './onboarding/OnboardingSteps';
import GestureDemo from './onboarding/GestureDemo';

interface OnboardingSpotlightProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingSpotlight = ({ onComplete }: OnboardingSpotlightProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(false);

  const currentStepKey = STEP_ORDER[currentStepIndex];
  const currentStep = ONBOARDING_STEPS[currentStepKey];
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;

  // Navigate to the correct route for the current step
  useEffect(() => {
    if (currentStep.route !== location.pathname) {
      navigate(currentStep.route);
    }
  }, [currentStep.route, location.pathname, navigate]);

  // Find and highlight the target element
  const updateSpotlight = useCallback(() => {
    const targetId = currentStep.targetId;
    const fallbackId = currentStep.fallbackTargetId;
    
    let element = document.querySelector(`[data-onboarding="${targetId}"]`);
    if (!element && fallbackId) {
      element = document.querySelector(`[data-onboarding="${fallbackId}"]`);
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 12;
      setSpotlight({
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [currentStep]);

  useEffect(() => {
    const timer = setTimeout(updateSpotlight, 200);
    window.addEventListener('resize', updateSpotlight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSpotlight);
    };
  }, [updateSpotlight, currentStepIndex]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  // Calculate text position - ensure no overlap with spotlight
  const getTextPosition = () => {
    const viewportHeight = window.innerHeight;
    const spotlightBottom = spotlight.y + spotlight.height;
    const spotlightTop = spotlight.y;
    
    if (currentStep.labelPosition === 'top') {
      // Text above spotlight - ensure enough space
      return { top: Math.max(40, spotlightTop - 200), position: 'top' as const };
    }
    // Text below spotlight
    return { top: Math.min(spotlightBottom + 30, viewportHeight - 200), position: 'bottom' as const };
  };

  const textPos = getTextPosition();

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {isVisible && (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.width}
                height={spotlight.height}
                rx="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="hsl(var(--onboarding-overlay))"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight glow border */}
      {isVisible && (
        <motion.div
          className="absolute rounded-2xl border-2 border-onboarding-foreground/40"
          style={{
            boxShadow: '0 0 30px hsl(var(--onboarding-foreground) / 0.15)',
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            x: spotlight.x,
            y: spotlight.y,
            width: spotlight.width,
            height: spotlight.height,
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        />
      )}

      {/* Instruction text - plain text on dark overlay */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepKey}
          className="absolute left-0 right-0 px-8 text-center pointer-events-none"
          style={{ top: textPos.top }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          <h3 className="text-onboarding-foreground text-xl font-semibold mb-2">
            {currentStep.title}
          </h3>
          <p className="text-onboarding-foreground/75 text-sm max-w-[280px] mx-auto leading-relaxed">
            {currentStep.description}
          </p>
          
          {/* Gesture animation */}
          {currentStep.gesture && (
            <div className="mt-6">
              <GestureDemo type={currentStep.gesture} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Arrow pointing to spotlight */}
      {isVisible && (
        <motion.div
          className="absolute flex items-center justify-center pointer-events-none text-2xl text-onboarding-foreground"
          style={{
            left: spotlight.x + spotlight.width / 2 - 12,
            top: currentStep.labelPosition === 'top'
              ? spotlight.y - 32
              : spotlight.y + spotlight.height + 8,
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            y: currentStep.labelPosition === 'top' ? [0, 6, 0] : [0, -6, 0]
          }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {currentStep.labelPosition === 'top' ? '↓' : '↑'}
        </motion.div>
      )}

      {/* Single Next button - fixed at bottom, always visible */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center pointer-events-auto">
        <button
          onClick={handleNext}
          className="bg-onboarding-foreground text-charcoal px-10 py-3.5 rounded-full font-semibold text-base shadow-lg hover:opacity-90 transition-opacity"
        >
          {isLastStep ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export default OnboardingSpotlight;

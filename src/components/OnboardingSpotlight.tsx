import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ONBOARDING_STEPS, STEP_ORDER, OnboardingStepKey } from './onboarding/OnboardingSteps';
import GestureDemo from './onboarding/GestureDemo';

interface OnboardingSpotlightProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingSpotlight = ({ onComplete, onSkip }: OnboardingSpotlightProps) => {
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
    // Small delay to let DOM settle after navigation
    const timer = setTimeout(updateSpotlight, 150);
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

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Calculate label position based on spotlight
  const getLabelPosition = () => {
    if (currentStep.labelPosition === 'top') {
      // Position above the spotlight
      return Math.max(60, spotlight.y - 180);
    }
    // Position below the spotlight
    return spotlight.y + spotlight.height + 24;
  };

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
          fill="hsl(220 15% 12% / 0.92)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight glow border */}
      {isVisible && (
        <motion.div
          className="absolute rounded-2xl border-2 border-cream/40"
          style={{
            boxShadow: '0 0 30px rgba(245, 241, 232, 0.15)',
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

      {/* Instruction text - plain cream text on dark overlay, NO card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepKey}
          className="absolute left-0 right-0 px-6 text-center pointer-events-none"
          style={{ top: getLabelPosition() }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          <h3 className="text-cream text-xl font-semibold mb-2">
            {currentStep.title}
          </h3>
          <p className="text-cream/80 text-base max-w-xs mx-auto">
            {currentStep.description}
          </p>
          
          {/* Gesture animation */}
          {currentStep.gesture && (
            <div className="mt-4">
              <GestureDemo type={currentStep.gesture} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Arrow pointing to spotlight */}
      {isVisible && (
        <motion.div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            left: spotlight.x + spotlight.width / 2 - 20,
            top: currentStep.labelPosition === 'top'
              ? spotlight.y - 40
              : spotlight.y + spotlight.height + 8,
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            y: currentStep.labelPosition === 'top' ? [0, 8, 0] : [0, -8, 0]
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-3xl text-cream">
            {currentStep.labelPosition === 'top' ? '↓' : '↑'}
          </span>
        </motion.div>
      )}

      {/* Navigation controls - fixed at bottom center, always visible and clickable */}
      <div className="absolute bottom-28 left-0 right-0 flex items-center justify-center gap-6 pointer-events-auto px-6">
        {currentStepIndex > 0 && (
          <button
            onClick={handlePrev}
            className="text-cream/70 hover:text-cream text-base font-medium transition-colors"
          >
            Back
          </button>
        )}
        
        <button
          onClick={handleNext}
          className="bg-cream text-charcoal px-8 py-3 rounded-full font-semibold text-base hover:bg-cream/90 transition-colors"
        >
          {isLastStep ? 'Finish' : 'Next'}
        </button>

        <button
          onClick={onSkip}
          className="text-cream/70 hover:text-cream text-base font-medium transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Step indicator dots */}
      <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
        {STEP_ORDER.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentStepIndex
                ? 'bg-cream'
                : index < currentStepIndex
                ? 'bg-cream/50'
                : 'bg-cream/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default OnboardingSpotlight;

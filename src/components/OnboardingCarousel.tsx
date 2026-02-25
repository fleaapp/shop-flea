import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { preloadImages } from '@/utils/preloadAssets';

// Import onboarding assets
import tapToExpandGif from '@/assets/onboarding/tap-to-expand.gif';
import swipeLeftPass from '@/assets/onboarding/swipe-left-pass.svg';
import swipeUpCart from '@/assets/onboarding/swipe-up-cart.svg';
import swipeRightWishlist from '@/assets/onboarding/swipe-right-wishlist.svg';
// Preload all onboarding assets immediately on module load
const onboardingAssets = [tapToExpandGif, swipeLeftPass, swipeUpCart, swipeRightWishlist];
preloadImages(onboardingAssets);

interface OnboardingCarouselProps {
  open: boolean;
  onComplete: () => void;
}

interface Slide {
  image?: string;
  text: string;
  alt: string;
  isGif?: boolean;
  imageOffset?: string;
  // Spotlight mode — navigate to route and highlight a real element
  spotlight?: {
    route: string;
    targetSelector: string; // data-onboarding attribute value
  };
}

const slides: Slide[] = [
  {
    image: tapToExpandGif,
    text: 'Tap 👇 card for more details',
    alt: 'Tap to expand card',
    isGif: true,
  },
  {
    image: swipeLeftPass,
    text: 'Swipe 👈 to Pass ❌',
    alt: 'Swipe left to pass',
  },
  {
    image: swipeUpCart,
    text: 'Swipe 👆 to add to Cart 🛒',
    alt: 'Swipe up to add to cart',
    imageOffset: '-translate-y-4',
  },
  {
    image: swipeRightWishlist,
    text: 'Swipe 👉 to add to Wishlist 💌',
    alt: 'Swipe right to add to wishlist',
  },
  {
    text: 'Find your Wishlist here 💌',
    alt: 'Wishlist button location',
    spotlight: {
      route: '/cart',
      targetSelector: 'cart-wishlist-button',
    },
  },
];

const OnboardingCarousel = ({ open, onComplete }: OnboardingCarouselProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [spotlightRect, setSpotlightRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const slide = slides[currentSlide];

  // Reset slide when closing
  useEffect(() => {
    if (!open) {
      setCurrentSlide(0);
      setSpotlightRect(null);
    }
  }, [open]);

  // Navigate to correct route for spotlight slides
  useEffect(() => {
    if (!open || !slide.spotlight) return;
    if (slide.spotlight.route !== location.pathname) {
      navigate(slide.spotlight.route);
    }
  }, [open, slide, location.pathname, navigate]);

  // Find and measure the spotlight target element
  const measureSpotlight = useCallback(() => {
    if (!slide.spotlight) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(`[data-onboarding="${slide.spotlight.targetSelector}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const pad = 10;
      setSpotlightRect({
        x: rect.left - pad,
        y: rect.top - pad,
        w: rect.width + pad * 2,
        h: rect.height + pad * 2,
      });
    } else {
      setSpotlightRect(null);
    }
  }, [slide]);

  useEffect(() => {
    if (!open) return;
    // Delay to let navigation render
    const timer = setTimeout(measureSpotlight, 300);
    window.addEventListener('resize', measureSpotlight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measureSpotlight);
    };
  }, [open, measureSpotlight, currentSlide]);

  if (!open) return null;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    } else {
      // Navigate back to home before completing
      navigate('/');
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold) handleNext();
    else if (info.offset.x > threshold) handlePrev();
  };

  const isLastSlide = currentSlide === slides.length - 1;
  const isSpotlightSlide = !!slide.spotlight;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col">
      {/* Overlay — with or without spotlight cutout */}
      {isSpotlightSlide && spotlightRect ? (
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          <defs>
            <mask id="carousel-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={spotlightRect.x}
                y={spotlightRect.y}
                width={spotlightRect.w}
                height={spotlightRect.h}
                rx="16"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(30,30,30,0.92)"
            mask="url(#carousel-spotlight-mask)"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-charcoal/90" />
      )}

      {/* Spotlight glow ring */}
      {isSpotlightSlide && spotlightRect && (
        <motion.div
          className="absolute rounded-2xl pointer-events-none"
          style={{
            left: spotlightRect.x,
            top: spotlightRect.y,
            width: spotlightRect.w,
            height: spotlightRect.h,
            boxShadow: '0 0 24px 8px rgba(245,241,235,0.25), 0 0 48px 16px rgba(245,241,235,0.1)',
            zIndex: 1,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}

      {/* Bouncing arrow pointing at spotlight */}
      {isSpotlightSlide && spotlightRect && (
        <motion.div
          className="absolute text-cream text-2xl pointer-events-none"
          style={{
            left: spotlightRect.x + spotlightRect.w / 2 - 12,
            top: spotlightRect.y - 32,
            zIndex: 2,
          }}
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          ↓
        </motion.div>
      )}

      {/* Main content area */}
      <div className="relative flex-1 w-full flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            {/* Image/GIF container — only for non-spotlight slides */}
            {!isSpotlightSlide && slide.image && (
              <div className={`flex items-center justify-center w-[min(92vw,52vh,400px)] h-[min(92vw,52vh,400px)] ${slide.imageOffset || ''}`}>
                <img
                  src={slide.image}
                  alt={slide.alt}
                  className={`object-contain w-full h-full ${slide.isGif ? '' : ''}`}
                  style={slide.isGif ? { mixBlendMode: 'screen' } : undefined}
                />
              </div>
            )}

            {/* Text */}
            <p className={`text-cream text-xl font-semibold text-center leading-relaxed max-[375px]:text-lg ${!isSpotlightSlide && slide.image ? '-mt-6 max-[375px]:-mt-4' : ''}`}>
              {slide.text}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls pinned above bottom nav */}
      <div className="relative w-full px-6 pb-[calc(84px+env(safe-area-inset-bottom))] max-[375px]:pb-[calc(76px+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-sm -translate-y-6">
          {/* Pagination dots */}
          <div className="flex justify-center gap-2.5 mb-4">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  index === currentSlide ? 'bg-cream' : 'bg-cream/30'
                }`}
              />
            ))}
          </div>

          {/* Next button */}
          <div className="flex justify-center">
            <Button
              onClick={handleNext}
              className="px-12 py-3 h-12 rounded-full bg-charcoal-light text-cream font-semibold text-base hover:bg-charcoal-light/90"
            >
              {isLastSlide ? "Let's go!" : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingCarousel;

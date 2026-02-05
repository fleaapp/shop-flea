 import { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
 import { Button } from '@/components/ui/button';
 
 // Import onboarding assets
 import tapToExpandGif from '@/assets/onboarding/tap-to-expand.gif';
 import swipeLeftPass from '@/assets/onboarding/swipe-left-pass.svg';
 import swipeUpCart from '@/assets/onboarding/swipe-up-cart.svg';
 import swipeRightWishlist from '@/assets/onboarding/swipe-right-wishlist.svg';
 
 interface OnboardingCarouselProps {
   open: boolean;
   onComplete: () => void;
 }
 
 interface Slide {
   image: string;
   text: string;
   alt: string;
   isGif: boolean;
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
     isGif: false,
   },
   {
     image: swipeUpCart,
     text: 'Swipe 👆 to add to Cart 🛒',
     alt: 'Swipe up to add to cart',
     isGif: false,
   },
   {
     image: swipeRightWishlist,
     text: 'Swipe 👉 to add to Wishlist 💌',
     alt: 'Swipe right to add to wishlist',
     isGif: false,
   },
 ];
 
 const OnboardingCarousel = ({ open, onComplete }: OnboardingCarouselProps) => {
   const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
 
   // Reset slide when closing
   useEffect(() => {
     if (!open) {
       setCurrentSlide(0);
     }
   }, [open]);
 
   if (!open) return null;
 
   const handleNext = () => {
     if (currentSlide < slides.length - 1) {
      setDirection(1);
       setCurrentSlide(prev => prev + 1);
     } else {
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
    if (info.offset.x < -threshold) {
      // Swiped left -> next
      handleNext();
    } else if (info.offset.x > threshold) {
      // Swiped right -> previous
      handlePrev();
    }
  };

   const isLastSlide = currentSlide === slides.length - 1;
 
   return (
       <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center">
       {/* Dark overlay background - home screen visible underneath */}
       <div className="absolute inset-0 bg-charcoal/90" />
       
       {/* Main content area - centered image and text */}
         <div className="relative w-full flex flex-col items-center justify-center px-6 pb-[calc(96px+env(safe-area-inset-bottom))]">
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
             {/* Image/GIF container - consistent sizing */}
              <div className="flex items-center justify-center w-[min(92vw,52vh,400px)] h-[min(92vw,52vh,400px)]">
               <img
                 src={slides[currentSlide].image}
                 alt={slides[currentSlide].alt}
                 className={`object-contain ${
                   slides[currentSlide].isGif 
                     ? 'w-full h-full' 
                     : 'w-full h-full'
                 }`}
               />
             </div>
             
             {/* Text underneath - consistent styling */}
              <p className="text-cream text-xl font-semibold text-center leading-relaxed max-[375px]:text-lg -mt-6 max-[375px]:-mt-4">
               {slides[currentSlide].text}
             </p>
           </motion.div>
         </AnimatePresence>

          {/* Controls directly under text (kept above bottom nav via padding on this container) */}
          <div className="mt-16 w-full max-w-sm">
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
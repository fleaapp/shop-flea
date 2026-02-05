 import { useState, useEffect } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
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
 
   // Reset slide when closing
   useEffect(() => {
     if (!open) {
       setCurrentSlide(0);
     }
   }, [open]);
 
   if (!open) return null;
 
   const handleNext = () => {
     if (currentSlide < slides.length - 1) {
       setCurrentSlide(prev => prev + 1);
     } else {
       onComplete();
     }
   };
 
   const isLastSlide = currentSlide === slides.length - 1;
 
   return (
      <div className="fixed inset-0 z-50 flex flex-col">
       {/* Dark overlay background - home screen visible underneath */}
       <div className="absolute inset-0 bg-charcoal/90" />
       
       {/* Main content area - centered image and text */}
        <div className="relative flex-1 flex flex-col items-center justify-end px-6 pb-4 max-[375px]:pb-3">
         <AnimatePresence mode="wait">
           <motion.div
             key={currentSlide}
             initial={{ opacity: 0, x: 50 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -50 }}
             transition={{ duration: 0.3 }}
             className="flex flex-col items-center justify-center"
           >
             {/* Image/GIF container - consistent sizing */}
              <div className="flex items-center justify-center mb-2 w-[min(92vw,52vh,400px)] h-[min(92vw,52vh,400px)]">
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
              <p className="text-cream text-xl font-semibold text-center leading-relaxed max-[375px]:text-lg">
               {slides[currentSlide].text}
             </p>
           </motion.div>
         </AnimatePresence>
       </div>
 
       {/* Bottom section - pagination dots and Next button - positioned above bottom nav */}
        <div className="relative px-6 pb-[calc(96px+env(safe-area-inset-bottom))] max-[375px]:pb-[calc(84px+env(safe-area-inset-bottom))]">
         {/* Pagination dots */}
          <div className="flex justify-center gap-2.5 mb-2">
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
   );
 };
 
 export default OnboardingCarousel;
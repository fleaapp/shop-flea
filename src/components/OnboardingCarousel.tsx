 import { useState } from 'react';
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
 }
 
 const slides: Slide[] = [
   {
     image: tapToExpandGif,
     text: 'Tap 👇 card for more details',
     alt: 'Tap to expand card',
   },
   {
     image: swipeLeftPass,
     text: 'Swipe 👈 to Pass',
     alt: 'Swipe left to pass',
   },
   {
     image: swipeUpCart,
     text: 'Swipe 👆 to Cart',
     alt: 'Swipe up to add to cart',
   },
   {
     image: swipeRightWishlist,
     text: 'Swipe 👉 to Wishlist',
     alt: 'Swipe right to add to wishlist',
   },
 ];
 
 const OnboardingCarousel = ({ open, onComplete }: OnboardingCarouselProps) => {
   const [currentSlide, setCurrentSlide] = useState(0);
 
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
     <div className="fixed inset-0 z-50 bg-charcoal flex flex-col">
       {/* Main content area - centered image and text */}
       <div className="flex-1 flex flex-col items-center justify-center px-6">
         <AnimatePresence mode="wait">
           <motion.div
             key={currentSlide}
             initial={{ opacity: 0, x: 50 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -50 }}
             transition={{ duration: 0.3 }}
             className="flex flex-col items-center justify-center"
           >
             {/* Image/GIF container - centered */}
             <div className="flex items-center justify-center mb-8">
               <img
                 src={slides[currentSlide].image}
                 alt={slides[currentSlide].alt}
                 className="max-w-[280px] max-h-[400px] object-contain"
               />
             </div>
             
             {/* Text underneath */}
             <p className="text-cream text-xl font-medium text-center">
               {slides[currentSlide].text}
             </p>
           </motion.div>
         </AnimatePresence>
       </div>
 
       {/* Bottom section - pagination dots and Next button */}
       <div className="pb-12 px-6">
         {/* Pagination dots */}
         <div className="flex justify-center gap-2 mb-8">
           {slides.map((_, index) => (
             <div
               key={index}
               className={`w-2 h-2 rounded-full transition-colors ${
                 index === currentSlide ? 'bg-cream' : 'bg-cream/30'
               }`}
             />
           ))}
         </div>
 
         {/* Next button */}
         <div className="flex justify-center">
           <Button
             onClick={handleNext}
             className="px-10 py-3 h-12 rounded-full bg-cream text-charcoal font-semibold text-base hover:bg-cream/90"
           >
             {isLastSlide ? "Let's go!" : 'Next'}
           </Button>
         </div>
       </div>
     </div>
   );
 };
 
 export default OnboardingCarousel;
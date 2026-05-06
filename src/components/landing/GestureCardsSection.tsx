import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import GestureCard from "./GestureCard";

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, delay },
});

const cards = [
  { header: "Swipe Up 👆", subhead: "Add to Cart 🛒", direction: "up" as const },
  { header: "Swipe Left 👈", subhead: "Pass ❌", direction: "left" as const },
  { header: "Swipe Right 👉", subhead: "Add to Wishlist 💌", direction: "right" as const },
  { header: "Swipe Down 👇", subhead: "Skip ⏭️", direction: "down" as const },
  { header: "Tap 👆", subhead: "View More Info ℹ️", direction: "tap" as const },
];

const GestureCardsSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const prev = () => { setDirection(-1); setActiveIndex((i) => (i - 1 + cards.length) % cards.length); };
  const next = () => { setDirection(1); setActiveIndex((i) => (i + 1) % cards.length); };

  return (
    <section className="bg-navy px-4 py-14 md:py-18">
      <div className="container mx-auto max-w-7xl">
        <motion.div className="text-center mb-14" {...reveal(0)}>
          <h2 className="text-secondary font-black text-lg md:text-xl uppercase tracking-wider mb-2">
            Swiping, Simplified
          </h2>
          <p className="text-mint text-sm md:text-base">Save. Skip. Shop. See More.</p>
        </motion.div>

        <motion.div className="hidden md:grid md:grid-cols-5 gap-10" {...reveal(0.08)}>
          {cards.map((card) => (<GestureCard key={card.direction} {...card} />))}
        </motion.div>

        <motion.div className="flex flex-col items-center md:hidden" {...reveal(0.08)}>
          <div className="w-full flex justify-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeIndex}
                custom={direction}
                initial={{ opacity: 0, x: direction * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -60 }}
                transition={{ duration: 0.25 }}
                className="w-full flex justify-center"
              >
                <GestureCard {...cards[activeIndex]} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center gap-8 mt-8">
            <button onClick={prev} className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform shadow-lg" aria-label="Previous card">
              <ArrowLeft size={32} className="text-navy" strokeWidth={3} />
            </button>
            <button onClick={next} className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform shadow-lg" aria-label="Next card">
              <ArrowRight size={32} className="text-navy" strokeWidth={3} />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default GestureCardsSection;

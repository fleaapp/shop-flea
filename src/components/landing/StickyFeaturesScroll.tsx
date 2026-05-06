import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import SwipeCardStack from "./SwipeCardStack";
import FloatingCardMarquee from "./FloatingCardMarquee";
import FilterBubblesCloud from "./FilterBubblesCloud";
import GridToStackAnimation from "./GridToStackAnimation";
import phoneMockup from "@/assets/flea-landing/phone-mockup.png";
import shopSellSwipeGif from "@/assets/flea-landing/shop-sell-swipe.gif";

const blocks: { heading: string; detail: ReactNode; animation?: ReactNode }[] = [
  {
    heading: "Ditch the tiny thumbnails and the crowded grids.",
    detail: (<>Flea shows you <strong>one listing at a time</strong> in full-screen glory. It's the end of the "squint-and-scroll" - we give every listing the <strong>spotlight it actually deserves</strong>.</>),
    animation: <GridToStackAnimation />,
  },
  {
    heading: "Sick of seeing the same recycled listings every time you open the app?",
    detail: (<>Our swipe logic <strong>clears the deck</strong> so you only ever see what's new to you. It's a fresh hunt with every flick of the thumb. <strong>Zero repeats, zero deja-vu</strong>.</>),
    animation: <SwipeCardStack />,
  },
  {
    heading: 'Trade a "suggested" feed that guesses your taste (and usually gets it wrong).',
    detail: (<>Every swipe trains Flea to <strong>learn your style</strong>. Replacing generic suggestions with a feed built on <strong>your actual behaviour</strong> - <strong>not a lucky dip</strong>.</>),
    animation: <FilterBubblesCloud />,
  },
  {
    heading: "Don't let your listings get buried in the noise.",
    detail: (<>On Flea, you aren't just another tile in a noisy grid - <strong>you're the only listing on the screen</strong>.<br /><strong>No crowd. No competition.</strong></>),
    animation: (
      <div className="relative mt-2 mb-2 w-full flex justify-center">
        <img src={phoneMockup} alt="Flea app showing a listing with full-screen attention" className="w-56 md:w-64 drop-shadow-2xl" />
        <FloatingCardMarquee />
      </div>
    ),
  },
  {
    heading: "High fees shouldn't kill the thrill of the sale.",
    detail: (<>We've kept our cut <strong>fair</strong> so the post office run is <strong>actually worth it</strong>.</>),
    animation: (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-xs md:max-w-sm">
        <img src={shopSellSwipeGif} alt="Shop and sell secondhand with a swipe" className="w-full rounded-2xl shadow-2xl" />
      </motion.div>
    ),
  },
  {
    heading: 'Never accidentally scroll past "the one" again.',
    detail: (<>Endless scrolling is a graveyard for good taste. By focusing on <strong>one item at a time</strong>, we make sure your next favourite staple <strong>doesn't get lost in the shuffle</strong>.</>),
  },
];

const Block = ({ heading, detail, animation, isAccent }: { heading: string; detail: ReactNode; animation?: ReactNode; isAccent: boolean; }) => {
  const textColor = isAccent ? "text-navy" : "text-mint";
  return (
    <motion.div
      initial={{ y: 28 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col pointer-events-none"
    >
      <div className="px-16 md:px-24 flex-shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 7rem)" }}>
        <h3 className={`text-xl md:text-3xl font-bold leading-snug text-center max-w-sm mx-auto ${textColor}`}>{heading}</h3>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center pointer-events-auto">{animation}</div>
      <div className="px-16 md:px-24 flex-shrink-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4rem)" }}>
        <p className={`text-base md:text-lg font-normal leading-relaxed text-center max-w-sm mx-auto ${textColor}`}>{detail}</p>
      </div>
    </motion.div>
  );
};

const Dot = ({ isActive, isAccent }: { isActive: boolean; isAccent: boolean }) => (
  <span className={`block h-1.5 w-1.5 rounded-full transition-all duration-200 ${isAccent ? "bg-navy" : "bg-mint"} ${isActive ? "scale-[1.6] opacity-100" : "opacity-30"}`} />
);

const StickyFeaturesScroll = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextIndex = Math.max(0, Math.min(blocks.length - 1, Math.floor(latest * blocks.length)));
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
  });

  return (
    <section ref={containerRef} className="relative" style={{ height: `${(blocks.length + 1) * 115}vh` }}>
      <div className={`sticky top-0 h-screen w-full overflow-hidden transition-colors duration-300 ${[1, 3, 5].includes(activeIndex) ? "bg-mint" : "bg-navy"}`}>
        <div className="relative h-full w-full">
          <Block
            key={activeIndex}
            heading={blocks[activeIndex].heading}
            detail={blocks[activeIndex].detail}
            animation={blocks[activeIndex].animation}
            isAccent={[1, 3, 5].includes(activeIndex)}
          />
          <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            {blocks.map((_, i) => (
              <Dot key={i} isActive={i === activeIndex} isAccent={[1, 4, 6].includes(activeIndex)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StickyFeaturesScroll;

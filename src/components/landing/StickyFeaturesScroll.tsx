import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import SwipeCardStack from "./SwipeCardStack";
import FloatingCardMarquee from "./FloatingCardMarquee";
import FilterBubblesCloud from "./FilterBubblesCloud";
import GridToStackAnimation from "./GridToStackAnimation";
import phoneMockup from "@/assets/flea-landing/phone-mockup.webp";
import shopSellSwipeGif from "@/assets/flea-landing/australian-female-founded.gif";

const blocks: { heading: ReactNode; detail: ReactNode; animation?: ReactNode }[] = [
  {
    heading: (
      <>
        <span className="md:hidden">GOODBYE,<br />SQUINT-AND-SCROLL.</span>
        <span className="hidden md:inline whitespace-nowrap">GOODBYE, SQUINT-AND-SCROLL.</span>
      </>
    ),
    detail: (
      <>
        <span className="md:hidden">Ditch the crowded, noisy feeds.<br />One listing, full screen, no distractions.</span>
        <span className="hidden md:inline">Ditch the crowded, headache causing grids.<br />One listing, full screen, zero distractions.</span>
      </>
    ),
    animation: <GridToStackAnimation />,
  },
  {
    heading: (
      <>
        <span className="md:hidden">NO MORE<br />"ALREADY SEEN THAT"</span>
        <span className="hidden md:inline whitespace-nowrap">NO MORE "SEEN THAT ALREADY"</span>
      </>
    ),
    detail: (
      <>
        <span className="md:hidden">Stop sifting through the same,<br />stale&nbsp;listings.<br />Our swipe logic clears the deck,<br />so every swipe is a first&nbsp;look.</span>
        <span className="hidden md:inline">Stop sifting through the same, stale listings.<br />Our swipe logic clears the deck, so every swipe is a first look.</span>
      </>
    ),
    animation: <SwipeCardStack />,
  },
  {
    heading: (
      <>
        <span className="md:hidden">BUILT ON<br />YOUR BEHAVIOUR</span>
        <span className="hidden md:inline whitespace-nowrap">BUILT ON YOUR BEHAVIOUR</span>
      </>
    ),
    detail: (
      <>
        <span className="md:hidden">Forget the lucky dip “suggested” feed.<br />Every swipe trains Flea to learn your style.</span>
        <span className="hidden md:inline">Forget the generic, lucky dip "suggested" feed.<br />Every swipe trains Flea to learn your style.</span>
      </>
    ),
    animation: <FilterBubblesCloud />,
  },
  {
    heading: (
      <>
        <span className="md:hidden">KILL THE<br />COMPETITION</span>
        <span className="hidden md:inline whitespace-nowrap">KILL THE COMPETITION</span>
      </>
    ),
    detail: (
      <>
        <span className="md:hidden">Why be one tile amongst&nbsp;hundreds?<br />On Flea, your listing is<br />the only one on the&nbsp;screen.</span>
        <span className="hidden md:inline">Why be one tile in a crowd?<br />On Flea, your listing is the only one on the screen.</span>
      </>
    ),
    animation: (
      <div className="relative mt-2 mb-2 w-screen max-w-none flex justify-center">
        <img src={phoneMockup} alt="Flea app showing a listing with full-screen attention" className="w-36 min-[360px]:w-40 min-[390px]:w-44 min-[414px]:w-52 min-[440px]:w-56 md:w-60 drop-shadow-2xl" loading="lazy" decoding="async" />
        <FloatingCardMarquee />
      </div>
    ),
  },
  {
    heading: (
      <>
        <span className="md:hidden">FAIR FEES.<br />FINALLY.</span>
        <span className="hidden md:inline whitespace-nowrap">FAIR FEES. FINALLY.</span>
      </>
    ),
    detail: (
      <>
        <span className="md:hidden">We've kept our cut <strong>fair</strong>,<br />so the post office run is <strong>actually worth it</strong>.</span>
        <span className="hidden md:inline">We've kept our cut <strong>fair</strong> so the post office run is <strong>actually worth it</strong>.</span>
      </>
    ),
    animation: (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[18rem] min-[390px]:max-w-[20rem] md:max-w-xs mx-auto">
        <img src={shopSellSwipeGif} alt="Shop and sell secondhand with a swipe" className="w-full rounded-2xl shadow-2xl" loading="lazy" decoding="async" />
      </motion.div>
    ),
  },
];

const Block = ({ heading, detail, animation, isAccent, index }: { heading: ReactNode; detail: ReactNode; animation?: ReactNode; isAccent: boolean; index: number; }) => {
  const textColor = isAccent ? "text-navy" : "text-mint";
  const extraBottom = index === 2 || index === 4
    ? "pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] min-[390px]:pb-[calc(env(safe-area-inset-bottom,0px)+8rem)]"
    : "pb-[calc(env(safe-area-inset-bottom,0px)+3.25rem)] min-[390px]:pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]";
  return (
    <motion.div
      initial={{ y: 28 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col pointer-events-none"
    >
      <div className="px-8 min-[390px]:px-8 md:px-12 lg:px-16 flex-shrink-0 pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] min-[390px]:pt-[calc(env(safe-area-inset-top,0px)+10rem)] md:pt-[calc(env(safe-area-inset-top,0px)+9rem)] lg:pt-[calc(env(safe-area-inset-top,0px)+10rem)]">
        <h3 className={`text-[22px] min-[390px]:text-[28px] md:text-[1.5rem] lg:text-[2.125rem] font-bold leading-tight md:leading-tight text-center max-w-sm md:max-w-none mx-auto ${textColor}`}>{heading}</h3>
      </div>
      <div className={`flex-1 min-h-0 flex items-center justify-center pointer-events-auto ${index === 3 ? "" : "overflow-hidden"}`}>
        <div className={`w-full h-full flex items-center justify-center origin-center ${index === 3 ? "" : "scale-[0.78] min-[440px]:scale-100"} ${index === 3 ? "" : "md:scale-[0.72] lg:scale-[0.78]"}`}>{animation}</div>
      </div>

      <div className={`px-8 min-[390px]:px-8 md:px-12 lg:px-16 flex-shrink-0 ${extraBottom} md:pb-[calc(env(safe-area-inset-bottom,0px)+4rem)]`}>
        <p className={`text-[14px] min-[390px]:text-base md:text-xl lg:text-2xl font-normal leading-relaxed text-center max-w-sm md:max-w-2xl lg:max-w-3xl mx-auto ${textColor}`}>{detail}</p>
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
      <div className={`sticky top-0 h-screen w-full overflow-hidden transition-colors duration-300 ${[1, 3].includes(activeIndex) ? "bg-mint" : "bg-navy"}`}>
        <div className="relative h-full w-full">
          <Block
            key={activeIndex}
            heading={blocks[activeIndex].heading}
            detail={blocks[activeIndex].detail}
            animation={blocks[activeIndex].animation}
            isAccent={[1, 3].includes(activeIndex)}
            index={activeIndex}
          />
          <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            {blocks.map((_, i) => (
              <Dot key={i} isActive={i === activeIndex} isAccent={[1, 3].includes(activeIndex)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StickyFeaturesScroll;

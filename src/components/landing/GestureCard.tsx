import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate, useReducedMotion } from "framer-motion";
import listingSneakers from "@/assets/flea-landing/listing-sneakers.jpg";
import listingBag from "@/assets/flea-landing/listing-bag.jpg";

type GestureDirection = "right" | "left" | "up" | "down" | "tap";

interface GestureCardProps {
  header: string;
  subhead: string;
  direction: GestureDirection;
}

const MiniCard = ({ direction }: { direction: GestureDirection }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  const scale = useMotionValue(1);
  const overlayOpacity = useMotionValue(0);
  const shouldReduceMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const runAnimation = () => {
      x.set(0); y.set(0); rotate.set(0); scale.set(1); overlayOpacity.set(0);
      const delay = 600;

      if (direction === "left") {
        timerRef.current = setTimeout(() => {
          animate(overlayOpacity, 1, { duration: 0.2 });
          animate(x, -120, { duration: 0.5, ease: "easeIn", delay: 0.15 });
          animate(rotate, -15, {
            duration: 0.5, ease: "easeIn", delay: 0.15,
            onComplete: () => { setTimeout(runAnimation, 800); },
          });
        }, delay);
      } else if (direction === "right") {
        timerRef.current = setTimeout(() => {
          animate(overlayOpacity, 1, { duration: 0.2 });
          animate(x, 120, { duration: 0.5, ease: "easeIn", delay: 0.15 });
          animate(rotate, 15, {
            duration: 0.5, ease: "easeIn", delay: 0.15,
            onComplete: () => { setTimeout(runAnimation, 800); },
          });
        }, delay);
      } else if (direction === "up") {
        timerRef.current = setTimeout(() => {
          animate(overlayOpacity, 1, { duration: 0.2 });
          animate(y, -120, { duration: 0.5, ease: "easeIn", delay: 0.15 });
          animate(scale, 0.9, {
            duration: 0.5, ease: "easeIn", delay: 0.15,
            onComplete: () => { setTimeout(runAnimation, 800); },
          });
        }, delay);
      } else if (direction === "down") {
        timerRef.current = setTimeout(() => {
          animate(overlayOpacity, 1, { duration: 0.2 });
          animate(y, 140, { duration: 0.5, ease: "easeIn", delay: 0.15 });
          animate(scale, 0.9, {
            duration: 0.5, ease: "easeIn", delay: 0.15,
            onComplete: () => { setTimeout(runAnimation, 800); },
          });
        }, delay);
      } else {
        timerRef.current = setTimeout(() => {
          animate(scale, 0.92, {
            duration: 0.12,
            onComplete: () => {
              animate(scale, 1, {
                duration: 0.12,
                onComplete: () => {
                  animate(overlayOpacity, 1, {
                    duration: 0.3,
                    onComplete: () => { setTimeout(runAnimation, 1200); },
                  });
                },
              });
            },
          });
        }, delay);
      }
    };

    runAnimation();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [direction, shouldReduceMotion]);

  const emoji =
    direction === "left" ? "❌"
    : direction === "right" ? "💌"
    : direction === "up" ? "🛒"
    : direction === "down" ? "⏭️"
    : "ℹ️";

  const backCardData = { image: listingBag, title: "Vintage Leather Bag", size: "One Size", brand: "Coach", price: 45, shipping: 8 };
  const topCardData = { image: listingSneakers, title: "Retro Sneakers", size: "US 9", brand: "Nike", price: 55, shipping: 12 };

  return (
    <div className="relative w-full aspect-[3/4.5] mx-auto max-w-[140px]">
      <div className="absolute inset-0 rounded-2xl bg-card shadow-md" style={{ transform: "translateX(6px) translateY(4px) rotate(3deg)" }}>
        <div className="flex h-full flex-col overflow-hidden rounded-2xl p-1.5">
          <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl bg-muted">
            <img src={backCardData.image} alt="" className="h-full w-full object-cover opacity-60" draggable={false} />
          </div>
          <div className="px-1.5 pt-1.5 pb-0.5 flex-shrink-0">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-[8px] font-semibold text-foreground truncate">{backCardData.title}</h3>
                <div className="mt-0.5 flex gap-0.5">
                  <span className="text-[6px] bg-[hsl(0,0%,91%)] text-foreground px-1 py-px rounded-full font-medium">{backCardData.size}</span>
                  <span className="text-[6px] bg-[hsl(0,0%,91%)] text-foreground px-1 py-px rounded-full font-medium">{backCardData.brand}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-1">
                <p className="text-[9px] font-bold text-foreground leading-tight">${backCardData.price}</p>
                <p className="text-[5px] text-muted-foreground">📦 +${backCardData.shipping}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div className="absolute inset-0 rounded-2xl bg-card shadow-xl" style={{ x, y, rotate, scale }}>
        <div className="flex h-full flex-col overflow-hidden rounded-2xl p-1.5">
          <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl bg-muted">
            <img src={topCardData.image} alt="" className="h-full w-full object-cover" draggable={false} />
            <motion.div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-xl" style={{ opacity: overlayOpacity }}>
              <span className="text-4xl">{emoji}</span>
            </motion.div>
          </div>
          <div className="px-1.5 pt-1.5 pb-0.5 flex-shrink-0">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-[8px] font-semibold text-foreground truncate">{topCardData.title}</h3>
                <div className="mt-0.5 flex gap-0.5">
                  <span className="text-[6px] bg-[hsl(0,0%,91%)] text-foreground px-1 py-px rounded-full font-medium">{topCardData.size}</span>
                  <span className="text-[6px] bg-[hsl(0,0%,91%)] text-foreground px-1 py-px rounded-full font-medium">{topCardData.brand}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-1">
                <p className="text-[9px] font-bold text-foreground leading-tight">${topCardData.price}</p>
                <p className="text-[5px] text-muted-foreground">📦 +${topCardData.shipping}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const GestureCard = ({ header, subhead, direction }: GestureCardProps) => {
  return (
    <div className="relative flex-shrink-0 w-full max-w-[340px] rounded-3xl pt-20 pb-14 px-6 flex flex-col items-center justify-center gap-6 md:hover:scale-[1.03] md:transition-transform">
      <div className="absolute inset-0 rounded-3xl bg-cream opacity-10" />
      <div className="relative z-20 w-full max-w-[200px]">
        <MiniCard direction={direction} />
      </div>
      <div className="relative z-10 text-center mt-4 translate-y-4">
        <p className="text-flea-cream font-black text-lg">{header}</p>
        <p className="text-flea-cream text-base mt-1">{subhead}</p>
      </div>
    </div>
  );
};

export default GestureCard;

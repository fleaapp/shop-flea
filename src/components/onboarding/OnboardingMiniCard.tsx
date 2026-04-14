import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate, useReducedMotion } from "framer-motion";
import listingSneakers from "@/assets/onboarding/listing-sneakers.jpg";
import listingBag from "@/assets/onboarding/listing-bag.jpg";

export type GestureDirection = "right" | "left" | "up" | "tap";

interface OnboardingMiniCardProps {
  direction: GestureDirection;
}

const OnboardingMiniCard = ({ direction }: OnboardingMiniCardProps) => {
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
      // Reset
      x.set(0);
      y.set(0);
      rotate.set(0);
      scale.set(1);
      overlayOpacity.set(0);

      const delay = 600;

      if (direction === "left") {
        timerRef.current = setTimeout(() => {
          animate(overlayOpacity, 1, { duration: 0.2 });
          animate(x, -120, { duration: 0.5, ease: "easeIn", delay: 0.15 });
          animate(rotate, -15, {
            duration: 0.5,
            ease: "easeIn",
            delay: 0.15,
            onComplete: () => {
              setTimeout(runAnimation, 800);
            },
          });
        }, delay);
      } else if (direction === "right") {
        timerRef.current = setTimeout(() => {
          animate(overlayOpacity, 1, { duration: 0.2 });
          animate(x, 120, { duration: 0.5, ease: "easeIn", delay: 0.15 });
          animate(rotate, 15, {
            duration: 0.5,
            ease: "easeIn",
            delay: 0.15,
            onComplete: () => {
              setTimeout(runAnimation, 800);
            },
          });
        }, delay);
      } else if (direction === "up") {
        timerRef.current = setTimeout(() => {
          animate(overlayOpacity, 1, { duration: 0.2 });
          animate(y, -120, { duration: 0.5, ease: "easeIn", delay: 0.15 });
          animate(scale, 0.9, {
            duration: 0.5,
            ease: "easeIn",
            delay: 0.15,
            onComplete: () => {
              setTimeout(runAnimation, 800);
            },
          });
        }, delay);
      } else {
        // tap
        timerRef.current = setTimeout(() => {
          animate(scale, 0.92, {
            duration: 0.12,
            onComplete: () => {
              animate(scale, 1, {
                duration: 0.12,
                onComplete: () => {
                  animate(overlayOpacity, 1, {
                    duration: 0.3,
                    onComplete: () => {
                      setTimeout(runAnimation, 1200);
                    },
                  });
                },
              });
            },
          });
        }, delay);
      }
    };

    runAnimation();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [direction, shouldReduceMotion]);

  const emoji =
    direction === "left"
      ? "❌"
      : direction === "right"
        ? "💌"
        : direction === "up"
          ? "🛒"
          : "ℹ️";

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: 160, aspectRatio: '3/4.6' }}>
      {/* Back card hint */}
      <div
        className="absolute inset-0 rounded-2xl bg-card shadow-md"
        style={{ transform: "translateX(6px) translateY(4px) rotate(3deg)" }}
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl p-1.5">
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden">
            <img
              src={listingBag}
              alt=""
              className="h-full w-full object-cover opacity-60"
              draggable={false}
            />
          </div>
          <div className="px-1.5 pt-1.5 pb-1">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-[10px] font-semibold text-foreground/40 truncate">Vintage Bag</h3>
                <div className="mt-0.5 flex gap-0.5">
                  <span className="text-[7px] bg-muted text-muted-foreground/40 px-1.5 py-0.5 rounded-full">One Size</span>
                  <span className="text-[7px] bg-muted text-muted-foreground/40 px-1.5 py-0.5 rounded-full">Coach</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-1">
                <p className="text-[11px] font-bold text-foreground/40">$45</p>
                <p className="text-[7px] text-muted-foreground/40">📦 +$8</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top card */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-card shadow-xl"
        style={{ x, y, rotate, scale }}
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl p-1.5">
          <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden">
            <img
              src={listingSneakers}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center rounded-xl"
              style={{
                opacity: overlayOpacity,
                backgroundColor: "rgba(0,0,0,0.1)",
              }}
            >
              <span className="text-5xl">{emoji}</span>
            </motion.div>
          </div>
          <div className="px-1.5 pt-1.5 pb-1">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-[10px] font-semibold text-foreground truncate">Retro Sneakers</h3>
                <div className="mt-0.5 flex gap-0.5">
                  <span className="text-[7px] bg-muted text-foreground/70 px-1.5 py-0.5 rounded-full font-medium">US 9</span>
                  <span className="text-[7px] bg-muted text-foreground/70 px-1.5 py-0.5 rounded-full font-medium">Nike</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-1">
                <p className="text-[11px] font-bold text-foreground">$55</p>
                <p className="text-[7px] text-muted-foreground">📦 +$12</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingMiniCard;

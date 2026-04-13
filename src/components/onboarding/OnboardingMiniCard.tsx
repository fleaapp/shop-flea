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
    <div className="relative w-full aspect-[3/4] mx-auto" style={{ maxWidth: 200 }}>
      {/* Back card hint */}
      <div
        className="absolute inset-0 rounded-2xl bg-card shadow-md"
        style={{ transform: "translateX(6px) translateY(4px) rotate(3deg)" }}
      >
        <div className="h-full w-full overflow-hidden rounded-2xl p-1.5">
          <div className="h-full w-full rounded-xl overflow-hidden">
            <img
              src={listingBag}
              alt=""
              className="h-full w-full object-cover opacity-60"
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* Top card */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-card shadow-xl"
        style={{ x, y, rotate, scale }}
      >
        <div className="h-full w-full overflow-hidden rounded-2xl p-1.5">
          <div className="relative h-full w-full rounded-xl overflow-hidden">
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
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingMiniCard;

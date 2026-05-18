import { motion, useReducedMotion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import fleaLogo from "@/assets/flea-landing/flea-logo.webp";

const ScallopHeader = () => {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const scallopCount = isMobile ? 9 : 13;
  const viewBoxWidth = scallopCount * 2;
  const seamOverscan = 0.08;

  return (
    <header className="sticky top-0 z-50 w-full">
      <motion.div
        className="relative w-full will-change-transform"
        style={{ transformOrigin: "top center" }}
        initial={shouldReduceMotion ? false : { y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <div className="relative bg-primary">
          <div className="flex items-center justify-center h-[52px] md:h-[54px] pt-3">
            <motion.img
              src={fleaLogo}
              alt="Flea"
              className="h-[28px] md:h-[30px] object-contain z-10 -mt-1.5"
              width={75}
              height={30}
              decoding="async"
              initial={shouldReduceMotion ? false : { y: -12, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }
              }
            />
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative -mt-px w-full overflow-hidden leading-[0]"
          style={{
            backgroundColor: "transparent",
            aspectRatio: `${viewBoxWidth} / 1`,
          }}
        >
          <svg
            className="relative block w-full"
            style={{ top: "-2px", height: "calc(100% + 2px)" }}
            viewBox={`0 0 ${viewBoxWidth} 1`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {Array.from({ length: scallopCount }).map((_, index) => (
              <circle
                key={index}
                cx={index * 2 + 1}
                cy={-seamOverscan}
                r={1 + seamOverscan}
                fill="hsl(var(--primary))"
              />
            ))}
          </svg>
        </div>
      </motion.div>
    </header>
  );
};

export default ScallopHeader;

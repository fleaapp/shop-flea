import { memo, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, useMotionValue, animate, type MotionValue } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import listingBag from "@/assets/flea-landing/listing-bag.jpg";
import listingJacket from "@/assets/flea-landing/listing-jacket.jpg";
import listingSneakers from "@/assets/flea-landing/listing-sneakers.jpg";
import listingSweater from "@/assets/flea-landing/listing-sweater.jpg";

const listings = [
  { image: listingBag, title: "Vintage Leather Bag", size: "One Size", brand: "Coach", price: 45, shipping: 8 },
  { image: listingJacket, title: "Denim Jacket", size: "M", brand: "Levi's", price: 38, shipping: 10 },
  { image: listingSneakers, title: "Retro Sneakers", size: "US 9", brand: "Nike", price: 55, shipping: 12 },
  { image: listingSweater, title: "Knit Sweater", size: "S", brand: "Zara", price: 28, shipping: 7 },
];

const getListing = (i: number) => listings[i % listings.length];

const SwipeCardStack = () => {
  const isMobile = useIsMobile();
  const [index, setIndex] = useState(0);
  const [desktopLeavingIndex, setDesktopLeavingIndex] = useState<number | null>(null);
  const [desktopImagesReady, setDesktopImagesReady] = useState(false);
  const mobileSwipingRef = useRef(false);
  const desktopSwipingRef = useRef(false);
  const x = useMotionValue(0);
  const rotate = useMotionValue(0);
  const nopeOpacity = useMotionValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topCard = getListing(index);
  const middleCard = getListing(index + 1);
  const backCard = getListing(index + 2);
  const desktopLeavingCard = desktopLeavingIndex === null ? null : getListing(desktopLeavingIndex);

  useEffect(() => {
    if (isMobile) { setDesktopImagesReady(true); return; }
    setDesktopImagesReady(false);
    let cancelled = false;
    Promise.all(
      listings.map(({ image }) => new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "sync";
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = image;
        if (img.complete) resolve();
      }))
    ).then(() => { if (!cancelled) setDesktopImagesReady(true); });
    return () => { cancelled = true; };
  }, [isMobile]);

  const triggerMobileSwipe = useCallback(() => {
    if (mobileSwipingRef.current) return;
    mobileSwipingRef.current = true;
    animate(nopeOpacity, 1, { duration: 0.2 });
    animate(x, -400, { duration: 0.6, ease: "easeIn", delay: 0.15 });
    animate(rotate, -18, {
      duration: 0.6, ease: "easeIn", delay: 0.15,
      onComplete: () => {
        x.set(0); rotate.set(0); nopeOpacity.set(0);
        mobileSwipingRef.current = false;
        setIndex((p) => p + 1);
      },
    });
  }, [nopeOpacity, rotate, x]);

  const triggerDesktopSwipe = useCallback(() => {
    if (desktopSwipingRef.current || desktopLeavingIndex !== null) return;
    desktopSwipingRef.current = true;
    flushSync(() => {
      setDesktopLeavingIndex(index);
      setIndex((p) => p + 1);
    });
  }, [desktopLeavingIndex, index]);

  useEffect(() => {
    if (isMobile) {
      timerRef.current = setTimeout(triggerMobileSwipe, 1800);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    if (!desktopImagesReady || desktopLeavingIndex !== null) return;
    timerRef.current = setTimeout(triggerDesktopSwipe, 1800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [desktopImagesReady, desktopLeavingIndex, index, isMobile, triggerDesktopSwipe, triggerMobileSwipe]);

  return (
    <div className="relative mx-auto h-[310px] w-[220px] md:h-[370px] md:w-[260px]">
      <div key={`back-${index + 2}`} className="absolute inset-0" style={{ zIndex: 1, transform: "translateX(16px) translateY(8px) rotate(6deg)" }}>
        <CardContent card={backCard} stabilizeImage={!isMobile} />
      </div>
      <div key={`middle-${index + 1}`} className="absolute inset-0" style={{ zIndex: 2, transform: "translateX(8px) translateY(4px) rotate(3deg)" }}>
        <CardContent card={middleCard} stabilizeImage={!isMobile} />
      </div>
      {isMobile ? (
        <motion.div className="absolute inset-0" style={{ zIndex: 3, x, rotate }}>
          <CardContent card={topCard} nopeOpacity={nopeOpacity} />
        </motion.div>
      ) : (
        <>
          <div key={`top-${index}`} className="absolute inset-0" style={{ zIndex: 3 }}>
            <CardContent card={topCard} stabilizeImage />
          </div>
          {desktopLeavingCard ? (
            <motion.div
              key={desktopLeavingIndex}
              className="absolute inset-0"
              style={{ zIndex: 4, willChange: "transform" }}
              initial={{ x: 0, rotate: 0 }}
              animate={{ x: -400, rotate: -18 }}
              transition={{ duration: 0.6, ease: "easeIn", delay: 0.15 }}
              onAnimationComplete={() => {
                desktopSwipingRef.current = false;
                setDesktopLeavingIndex(null);
              }}
            >
              <CardContent card={desktopLeavingCard} showNope stabilizeImage />
            </motion.div>
          ) : null}
        </>
      )}
    </div>
  );
};

type CardContentProps = {
  card: (typeof listings)[number];
  nopeOpacity?: MotionValue<number>;
  showNope?: boolean;
  stabilizeImage?: boolean;
};

const CardContent = memo(({ card, nopeOpacity, showNope = false, stabilizeImage = false }: CardContentProps) => (
  <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-2.5 shadow-xl">
    <div
      className="relative flex-1 min-h-0 overflow-hidden rounded-2xl bg-muted"
      style={stabilizeImage ? {
        backgroundImage: `url(${card.image})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        contain: "paint",
        transform: "translateZ(0)",
      } : undefined}
    >
      <img
        src={card.image}
        alt={card.title}
        className="h-full w-full object-cover"
        draggable={false}
        decoding={stabilizeImage ? "sync" : "auto"}
        loading={stabilizeImage ? "eager" : undefined}
        style={stabilizeImage ? {
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: 0, pointerEvents: "none", backfaceVisibility: "hidden",
          transform: "translateZ(0)", willChange: "transform",
        } : undefined}
      />
      {nopeOpacity ? (
        <motion.div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-foreground/10" style={{ opacity: nopeOpacity }}>
          <span className="text-7xl md:text-8xl">❌</span>
        </motion.div>
      ) : showNope ? (
        <motion.div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-foreground/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <span className="text-7xl md:text-8xl">❌</span>
        </motion.div>
      ) : null}
    </div>
    <div className="px-2 pt-2.5 pb-1 flex-shrink-0">
      <div className="flex items-end justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-foreground truncate">{card.title}</h3>
          <div className="mt-1 flex gap-1">
            <span className="text-[10px] md:text-xs bg-[hsl(0,0%,91%)] text-foreground px-2 py-0.5 rounded-full font-medium">{card.size}</span>
            <span className="text-[10px] md:text-xs bg-[hsl(0,0%,91%)] text-foreground px-2 py-0.5 rounded-full font-medium">{card.brand}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className="text-base md:text-lg font-bold text-foreground leading-tight">${card.price}</p>
          <p className="text-[10px] text-muted-foreground">📦 +${card.shipping}</p>
        </div>
      </div>
    </div>
  </div>
));
CardContent.displayName = "CardContent";

export default SwipeCardStack;

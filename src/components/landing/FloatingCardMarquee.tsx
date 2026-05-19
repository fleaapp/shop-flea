import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import listingBag from "@/assets/flea-landing/listing-bag.webp";
import listingJacket from "@/assets/flea-landing/listing-jacket.webp";
import listingSneakers from "@/assets/flea-landing/listing-sneakers.webp";
import listingSweater from "@/assets/flea-landing/listing-sweater.webp";

const listings = [
  { image: listingBag, title: "Bag", size: "M", brand: "Coach", price: 45, shipping: 8 },
  { image: listingJacket, title: "Jacket", size: "L", brand: "Nike", price: 38, shipping: 10 },
  { image: listingSneakers, title: "Sneakers", size: "M", brand: "Zara", price: 55, shipping: 12 },
  { image: listingSweater, title: "Sweater", size: "S", brand: "Cos", price: 28, shipping: 7 },
  { image: listingBag, title: "Bag", size: "S", brand: "Kmart", price: 45, shipping: 8 },
  { image: listingJacket, title: "Jacket", size: "M", brand: "Zara", price: 38, shipping: 10 },
  { image: listingSneakers, title: "Sneakers", size: "L", brand: "Nike", price: 55, shipping: 12 },
  { image: listingSweater, title: "Sweater", size: "M", brand: "Cos", price: 28, shipping: 7 },
];

const MiniCard = ({ card, index }: { card: (typeof listings)[0]; index: number }) => {
  const angle = index % 2 === 0 ? "rotate-[3deg]" : "rotate-[-3deg]";
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl bg-card p-1.5 shadow-xl w-[100px] h-[143px] min-[390px]:w-[115px] min-[390px]:h-[164px] min-[440px]:w-[130px] min-[440px]:h-[186px] md:w-[150px] md:h-[214px] flex-shrink-0 ${angle}`}>
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl bg-muted">
        <img src={card.image} alt={card.title} className="h-full w-full object-cover" draggable={false} />
      </div>
      <div className="px-1.5 pt-1.5 pb-0.5 flex-shrink-0">
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-[10px] md:text-xs font-semibold text-foreground">{card.title}</h3>
            <div className="mt-0.5 flex gap-0.5">
              <span className="text-[8px] md:text-[9px] bg-[hsl(0,0%,91%)] text-foreground px-1.5 py-0.5 rounded-full font-medium">{card.size}</span>
              <span className="text-[8px] md:text-[9px] bg-[hsl(0,0%,91%)] text-foreground px-1.5 py-0.5 rounded-full font-medium">{card.brand}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-1">
            <p className="text-xs md:text-sm font-bold text-foreground leading-tight">${card.price}</p>
            <p className="text-[8px] text-muted-foreground">📦 +${card.shipping}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const FloatingCardMarquee = () => {
  const halfRef = useRef<HTMLDivElement>(null);
  const [halfWidth, setHalfWidth] = useState(0);

  useEffect(() => {
    if (halfRef.current) setHalfWidth(halfRef.current.scrollWidth);
  }, []);

  return (
    <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
      <div className="absolute top-[52%] -translate-y-1/2 w-full">
        <motion.div
          className="flex items-center gap-5 w-max"
          animate={halfWidth ? { x: [0, -halfWidth] } : undefined}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          <div ref={halfRef} className="flex items-center gap-5">
            {listings.map((card, i) => <MiniCard key={i} card={card} index={i} />)}
          </div>
          <div className="flex items-center gap-5">
            {listings.map((card, i) => <MiniCard key={`dup-${i}`} card={card} index={i} />)}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FloatingCardMarquee;

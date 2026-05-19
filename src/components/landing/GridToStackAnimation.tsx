import { motion } from "framer-motion";
import g1 from "@/assets/flea-landing/grid/g1.webp";
import g2 from "@/assets/flea-landing/grid/g2.webp";
import g3 from "@/assets/flea-landing/grid/g3.webp";
import g4 from "@/assets/flea-landing/grid/g4.webp";
import g5 from "@/assets/flea-landing/grid/g5.webp";
import g6 from "@/assets/flea-landing/grid/g6.webp";
import g7 from "@/assets/flea-landing/grid/g7.webp";
import g8 from "@/assets/flea-landing/grid/g8.webp";
import g9 from "@/assets/flea-landing/grid/g9.webp";
import g10 from "@/assets/flea-landing/grid/g10.webp";
import g11 from "@/assets/flea-landing/grid/g11.webp";
import g12 from "@/assets/flea-landing/grid/g12.webp";
import stackTee from "@/assets/flea-landing/stack-tee.webp";
import listingBag from "@/assets/flea-landing/listing-bag.webp";
import listingJacket from "@/assets/flea-landing/listing-jacket.webp";

const gridImages = [g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12];
const DURATION = 6.5;

const tiles = gridImages.map((img, i) => {
  const col = i % 3;
  const dir = col === 0 ? -1 : col === 2 ? 1 : i % 2 === 0 ? -1 : 1;
  return {
    img,
    exitX: `${dir * 60}vw`,
    exitY: ((i % 5) - 2) * 14,
    exitRotate: dir * (10 + (i % 5) * 4),
    delay: col * 0.04 + Math.floor(i / 3) * 0.02,
  };
});

const stackCards = [
  { image: listingBag, title: "Vintage Leather Bag", size: "One Size", brand: "Coach", price: 45, shipping: 8, offset: { x: 16, y: 8, r: 6 }, z: 1 },
  { image: listingJacket, title: "Denim Jacket", size: "M", brand: "Levi's", price: 38, shipping: 10, offset: { x: 8, y: 4, r: 3 }, z: 2 },
  { image: stackTee, title: "Allman Brothers Tee", size: "XL", brand: "Vintage", price: 42, shipping: 9, offset: { x: 0, y: 0, r: 0 }, z: 3 },
];

type Card = (typeof stackCards)[number];

const ListingCard = ({ card }: { card: Card }) => (
  <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-2.5 shadow-xl">
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl bg-muted">
      <img src={card.image} alt={card.title} className="h-full w-full object-cover" draggable={false} />
    </div>
    <div className="px-2 pt-2.5 pb-1 flex-shrink-0">
      <div className="flex items-end justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-xs md:text-sm font-semibold text-foreground truncate">{card.title}</h3>
          <div className="mt-1 flex gap-1">
            <span className="text-[9px] md:text-[10px] bg-[hsl(0,0%,91%)] text-foreground px-1.5 py-0.5 rounded-full font-medium">{card.size}</span>
            <span className="text-[9px] md:text-[10px] bg-[hsl(0,0%,91%)] text-foreground px-1.5 py-0.5 rounded-full font-medium">{card.brand}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className="text-sm md:text-base font-bold text-foreground leading-tight">${card.price}</p>
          <p className="text-[9px] text-muted-foreground">📦 +${card.shipping}</p>
        </div>
      </div>
    </div>
  </div>
);

const GridToStackAnimation = () => {
  return (
    <div className="relative mx-auto w-[260px] h-[340px] md:w-[290px] md:h-[380px]">
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="relative w-[180px] h-[260px] md:w-[210px] md:h-[300px]"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{
            scale: [0.95, 0.95, 1, 1, 0.95, 0.95],
            opacity: [0, 0, 1, 1, 0, 0],
          }}
          transition={{
            duration: DURATION,
            times: [0, 0.31, 0.311, 0.69, 0.691, 1],
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {stackCards.map((card, i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                zIndex: card.z,
                transform: `translate(${card.offset.x}px, ${card.offset.y}px) rotate(${card.offset.r}deg)`,
              }}
            >
              <ListingCard card={card} />
            </div>
          ))}
        </motion.div>
      </div>

      <div className="absolute inset-0 grid grid-cols-3 auto-rows-fr gap-1.5 p-1 z-10">
        {tiles.map((tile, i) => (
          <motion.div
            key={i}
            className="aspect-square overflow-hidden rounded-md bg-card shadow-md"
            initial={{ x: 0, y: 0, rotate: 0 }}
            animate={{
              x: [0, 0, tile.exitX, tile.exitX, 0, 0],
              y: [0, 0, tile.exitY, tile.exitY, 0, 0],
              rotate: [0, 0, tile.exitRotate, tile.exitRotate, 0, 0],
            }}
            transition={{
              duration: DURATION,
              times: [0, 0.18, 0.31, 0.69, 0.82, 1],
              delay: tile.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <img src={tile.img} alt="" className="w-full h-full object-cover" draggable={false} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default GridToStackAnimation;

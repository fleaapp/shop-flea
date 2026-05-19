import { motion } from "framer-motion";

const COLOUR_SWATCHES: Record<string, string> = {
  Black: "#000000",
  White: "#FFFFFF",
  Grey: "#9E9E9E",
  Navy: "#1B2A4A",
  Blue: "#2979FF",
  Green: "#4CAF50",
  Khaki: "#BDB76B",
  "Beige / Cream": "#F5F0E1",
  Brown: "#795548",
  Red: "#E53935",
  Pink: "#F48FB1",
  Purple: "#9C27B0",
  Yellow: "#FFEB3B",
  Orange: "#FF9800",
  Silver: "#C0C0C0",
  Gold: "#FFD700",
  Tan: "#D2B48C",
  "Multi / Patterned":
    "linear-gradient(90deg, #ff0033 0 14.28%, #ff8a00 14.28% 28.56%, #ffd400 28.56% 42.84%, #39d353 42.84% 57.12%, #00c2ff 57.12% 71.4%, #2f6bff 71.4% 85.68%, #c13cff 85.68% 100%)",
};

type Bubble = { label: string; selected: boolean; swatch?: string };

const rawBubbles: Bubble[] = [
  { label: "Tops", selected: true },
  { label: "Dresses", selected: false },
  { label: "Outerwear", selected: true },
  { label: "Shoes", selected: false },
  { label: "Accessories", selected: true },
  { label: "Activewear", selected: false },
  { label: "Black", selected: false, swatch: COLOUR_SWATCHES.Black },
  { label: "Beige / Cream", selected: true, swatch: COLOUR_SWATCHES["Beige / Cream"] },
  { label: "Green", selected: false, swatch: COLOUR_SWATCHES.Green },
  { label: "Brown", selected: true, swatch: COLOUR_SWATCHES.Brown },
  { label: "Khaki", selected: false, swatch: COLOUR_SWATCHES.Khaki },
  { label: "Multi / Patterned", selected: false, swatch: COLOUR_SWATCHES["Multi / Patterned"] },
  { label: "S", selected: false },
  { label: "M", selected: true },
  { label: "8", selected: true },
  { label: "10", selected: false },
  { label: "Women", selected: false },
  { label: "Men", selected: true },
  { label: "Unisex", selected: false },
  { label: "Vintage", selected: true },
  { label: "Y2K", selected: false },
  { label: "Streetwear", selected: true },
  { label: "Festival", selected: false },
  { label: "Like new", selected: false },
  { label: "Good", selected: true },
];

const topRowCount = 3;
const topRow = [...rawBubbles].sort(() => Math.random() - 0.5).slice(0, topRowCount);
const mainBubbleCount = 24;
const shuffled = [...rawBubbles].sort(() => Math.random() - 0.5).slice(0, mainBubbleCount);

const bubbleClass = (selected: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
    selected ? "bg-mint text-navy" : "bg-gray-200 text-gray-700"
  }`;

const BubbleSpan = ({ bubble, index }: { bubble: Bubble; index: number }) => {
  const duration = 2.6 + Math.random() * 2.2;
  const delay = (index % 14) * 0.18 + Math.random() * 1.6;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.4] }}
      transition={{
        duration, delay, times: [0, 0.12, 0.88, 1],
        ease: [0.34, 1.56, 0.64, 1], repeat: Infinity,
        repeatDelay: 0.4 + Math.random() * 1.2,
      }}
      className={bubbleClass(bubble.selected)}
      style={{ willChange: "transform, opacity" }}
    >
      {bubble.swatch && (
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: bubble.swatch }} />
      )}
      {bubble.label}
    </motion.span>
  );
};

const FilterBubblesCloud = () => {
  return (
    <div className="w-full max-w-2xl mx-auto px-8 md:px-10 space-y-1.5 md:space-y-2">
      <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
        {topRow.map((bubble, i) => (
          <BubbleSpan key={`top-${bubble.label}-${i}`} bubble={bubble} index={i} />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
        {shuffled.map((bubble, i) => (
          <BubbleSpan key={`main-${bubble.label}-${i}`} bubble={bubble} index={i + topRowCount} />
        ))}
      </div>
    </div>
  );
};

export default FilterBubblesCloud;

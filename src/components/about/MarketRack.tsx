import jacketImg from '@/assets/listing-jacket.jpg';
import bagImg from '@/assets/listing-bag.jpg';
import sneakersImg from '@/assets/listing-sneakers.jpg';
import sweaterImg from '@/assets/listing-sweater.jpg';

const cards = [
  { title: 'Denim Jacket', size: 'SIZE 8', brand: "Levi's", price: 22, shipping: 10, image: jacketImg, rotate: -5 },
  { title: 'Red Leather Bag', size: 'ONE SIZE', brand: 'Coach', price: 45, shipping: 8, image: bagImg, rotate: 2 },
  { title: 'White Sneakers', size: 'SIZE 10', brand: 'Nike', price: 85, shipping: 12, image: sneakersImg, rotate: -3 },
  { title: 'Cream Knit Sweater', size: 'ONE SIZE', brand: 'Zara', price: 35, shipping: 7, image: sweaterImg, rotate: 4 },
];

/** A miniature replica of the real SwipeCard, hanging from a hanger on a pole. */
const MiniListingCard = ({ card }: { card: typeof cards[number] }) => (
  <div
    className="flex flex-col items-center flex-shrink-0"
    style={{ transform: `rotate(${card.rotate}deg)` }}
  >
    {/* Hook wire */}
    <div className="w-[1.5px] h-3 md:h-4 bg-foreground/40" />
    {/* Hanger */}
    <svg viewBox="0 0 48 16" className="w-12 md:w-16 text-foreground/30 -mb-1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 1 L45 15 H3 Z" />
    </svg>

    {/* Card — exact same structure as SwipeCard */}
    <div className="w-[88px] md:w-[140px] flex flex-col overflow-hidden rounded-xl md:rounded-2xl bg-card p-[5px] md:p-2 card-shadow">
      {/* Image */}
      <div className="aspect-[4/5] overflow-hidden rounded-lg md:rounded-xl">
        <img
          src={card.image}
          alt={card.title}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>

      {/* Content — mirrors SwipeCard layout */}
      <div className="px-[3px] md:px-1.5 pt-1.5 md:pt-2 pb-[2px] md:pb-1">
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-[8px] md:text-xs font-semibold text-foreground truncate leading-tight">
              {card.title}
            </h3>
            <div className="mt-[3px] md:mt-1 flex flex-nowrap gap-[3px] md:gap-1 overflow-hidden">
              <span className="rounded-full bg-tag px-[5px] md:px-2 py-[1px] md:py-0.5 text-[5.5px] md:text-[9px] font-medium text-charcoal-light whitespace-nowrap">
                {card.size}
              </span>
              <span className="rounded-full bg-tag px-[5px] md:px-2 py-[1px] md:py-0.5 text-[5.5px] md:text-[9px] font-medium text-charcoal-light whitespace-nowrap truncate">
                {card.brand}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-1 md:ml-2">
            <p className="text-[9px] md:text-sm font-bold text-foreground leading-tight">${card.price}</p>
            <p className="text-[5px] md:text-[8px] text-muted-foreground whitespace-nowrap">+ ${card.shipping} 📦</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const MarketRack = () => {
  return (
    <div className="relative w-full max-w-xl mx-auto py-2">
      {/* Horizontal pole */}
      <div className="absolute top-2 left-0 right-0 h-[3px] md:h-1 bg-foreground/60 rounded-full z-0" />

      {/* Cards */}
      <div className="relative z-10 flex justify-center items-start gap-2 md:gap-4 pt-0">
        {cards.map((card, i) => (
          <MiniListingCard key={i} card={card} />
        ))}
      </div>
    </div>
  );
};

export default MarketRack;

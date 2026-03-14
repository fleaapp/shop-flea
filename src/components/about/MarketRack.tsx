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

/** Exact scaled-down replica of SwipeCard, hanging from a hanger on a pole. */
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

    {/* Card — identical structure to SwipeCard, scaled down */}
    <div className="w-[88px] md:w-[140px] flex flex-col overflow-hidden rounded-2xl md:rounded-3xl bg-card p-[4px] md:p-[6px] card-shadow">
      {/* Image — matches SwipeCard's rounded-2xl inner image */}
      <div className="overflow-hidden rounded-xl md:rounded-2xl">
        <div className="aspect-[4/5] overflow-hidden">
          <img
            src={card.image}
            alt={card.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </div>

      {/* Content — mirrors SwipeCard: px-2 pt-3 pb-1, scaled down */}
      <div className="px-[3px] md:px-[5px] pt-[5px] md:pt-[7px] pb-[2px] md:pb-[3px]">
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-[7px] md:text-[11px] font-semibold text-foreground truncate leading-tight">
              {card.title}
            </h3>
            <div className="mt-[2px] md:mt-[3px] flex flex-nowrap gap-[2px] md:gap-[3px] overflow-hidden">
              <span className="rounded-full bg-tag px-[4px] md:px-[7px] py-[1px] md:py-[2px] text-[5px] md:text-[8px] font-medium text-charcoal-light whitespace-nowrap">
                {card.size}
              </span>
              <span className="rounded-full bg-tag px-[4px] md:px-[7px] py-[1px] md:py-[2px] text-[5px] md:text-[8px] font-medium text-charcoal-light whitespace-nowrap truncate">
                {card.brand}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-[3px] md:ml-[5px]">
            <p className="text-[8px] md:text-[12px] font-bold text-foreground leading-tight">${card.price}</p>
            <p className="text-[4.5px] md:text-[7px] text-muted-foreground whitespace-nowrap">+ ${card.shipping} shipping</p>
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

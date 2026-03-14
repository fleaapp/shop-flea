import jacketImg from '@/assets/listing-jacket.jpg';
import bagImg from '@/assets/listing-bag.jpg';
import sneakersImg from '@/assets/listing-sneakers.jpg';
import sweaterImg from '@/assets/listing-sweater.jpg';
import ListingTag from '@/components/ListingTag';

const cards = [
  { title: 'Denim Jacket', size: '8', brand: "Levi's", price: 22, shippingPrice: 10, image: jacketImg, rotate: -5 },
  { title: 'Red Leather Bag', size: 'One Size', brand: 'Coach', price: 45, shippingPrice: 8, image: bagImg, rotate: 2 },
  { title: 'Puma Sneakers', size: '7.5', brand: 'Puma', price: 31, shippingPrice: 12, image: sneakersImg, rotate: -3 },
  { title: 'Cream Knit Sweater', size: 'One Size', brand: 'Zara', price: 35, shippingPrice: 7, image: sweaterImg, rotate: 4 },
];

/** Wooden hanger with clips SVG */
const WoodenHanger = () => (
  <svg viewBox="0 0 80 38" className="w-[80px]" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Hook — steel wire curling over the pole */}
    <path
      d="M40 0 C40 0, 40 4, 40 6 C40 9, 37 11, 34 11 C31 11, 29 9, 29 6 C29 4, 30 3, 32 3"
      stroke="#888"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
    />
    {/* Wooden bar — warm brown with rounded ends */}
    <rect x="8" y="14" width="64" height="5" rx="2.5" fill="#b5885a" />
    {/* Wood grain lines */}
    <line x1="12" y1="16" x2="68" y2="16" stroke="#a07040" strokeWidth="0.4" opacity="0.5" />
    <line x1="14" y1="17.5" x2="66" y2="17.5" stroke="#a07040" strokeWidth="0.3" opacity="0.4" />
    {/* Left clip */}
    <rect x="16" y="18" width="6" height="10" rx="1" fill="#888" />
    <rect x="17" y="19" width="4" height="3" rx="0.5" fill="#aaa" />
    <line x1="19" y1="22" x2="19" y2="28" stroke="#999" strokeWidth="0.8" />
    {/* Right clip */}
    <rect x="58" y="18" width="6" height="10" rx="1" fill="#888" />
    <rect x="59" y="19" width="4" height="3" rx="0.5" fill="#aaa" />
    <line x1="61" y1="22" x2="61" y2="28" stroke="#999" strokeWidth="0.8" />
    {/* Clip teeth (bottom jaws) */}
    <path d="M16 28 L19 30 L22 28" stroke="#777" strokeWidth="0.8" fill="none" />
    <path d="M58 28 L61 30 L64 28" stroke="#777" strokeWidth="0.8" fill="none" />
  </svg>
);

/** Home SwipeCard cloned 1:1, then uniformly scaled down, hanging from wooden hanger. */
const RackListingCard = ({ card }: { card: typeof cards[number] }) => (
  <div className="flex flex-col items-center flex-shrink-0" style={{ transform: `rotate(${card.rotate}deg)` }}>
    {/* Wooden hanger with hook and clips */}
    <WoodenHanger />

    {/* Fixed viewport box for the scaled full-size card — overlaps clip jaws */}
    <div className="relative w-[106px] h-[155px] -mt-[3px]">
      <div
        className="absolute left-1/2 top-0 w-[320px] h-[470px]"
        style={{ transform: 'translateX(-50%) scale(0.33)', transformOrigin: 'top center' }}
      >
        {/* Exact Home SwipeCard inner markup/classes */}
        <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-3 card-shadow">
          <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl">
            <img
              src={card.image}
              alt={card.title}
              className="h-full w-full object-cover"
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="px-2 max-[375px]:px-1.5 pt-3 max-[375px]:pt-2 pb-1 flex-shrink-0">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg max-[375px]:text-base font-semibold text-foreground truncate">{card.title}</h3>
                <div className="mt-1.5 max-[375px]:mt-1 flex flex-nowrap gap-1.5 max-[375px]:gap-1 overflow-x-auto scrollbar-hide">
                  <ListingTag label={card.size} isSize />
                  <ListingTag label={card.brand} />
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-3 max-[375px]:ml-2">
                <p className="text-xl max-[375px]:text-lg font-bold text-foreground leading-tight">${card.price}</p>
                <p className="text-xs max-[375px]:text-[10px] text-muted-foreground">+ ${card.shippingPrice} shipping</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const MarketRack = () => {
  return (
    <div className="relative w-full max-w-xl mx-auto py-2">
      {/* Steel horizontal pole */}
      <div className="absolute top-[6px] left-0 right-0 z-0">
        <div className="h-[5px] bg-gradient-to-b from-[#c0c0c0] via-[#e0e0e0] to-[#a0a0a0] rounded-full" />
        <div className="h-[1px] bg-[#888] rounded-full -mt-[1px]" />
      </div>

      <div className="relative z-10 flex justify-center items-start gap-1 pt-0">
        {cards.map((card, i) => (
          <RackListingCard key={i} card={card} />
        ))}
      </div>
    </div>
  );
};

export default MarketRack;

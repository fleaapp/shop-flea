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

/** Home SwipeCard cloned 1:1, then uniformly scaled down. */
const RackListingCard = ({ card }: { card: typeof cards[number] }) => (
  <div className="flex flex-col items-center flex-shrink-0" style={{ transform: `rotate(${card.rotate}deg)` }}>
    <div className="w-[1.5px] h-3 bg-foreground/40" />
    <svg
      viewBox="0 0 48 16"
      className="w-12 text-foreground/30 -mb-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M24 1 L45 15 H3 Z" />
    </svg>

    {/* Fixed viewport box for the scaled full-size card */}
    <div className="relative w-[106px] h-[155px]">
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
      <div className="absolute top-2 left-0 right-0 h-[3px] bg-foreground/60 rounded-full z-0" />

      <div className="relative z-10 flex justify-center items-start gap-1 pt-0">
        {cards.map((card, i) => (
          <RackListingCard key={i} card={card} />
        ))}
      </div>
    </div>
  );
};

export default MarketRack;

import jacketImg from '@/assets/listing-jacket.jpg';
import bagImg from '@/assets/listing-bag.jpg';
import sneakersImg from '@/assets/listing-sneakers.jpg';
import sweaterImg from '@/assets/listing-sweater.jpg';

const cards = [
  { title: 'Denim Jacket', size: 'SIZE 8', brand: "Levi's", price: 22, shipping: 10, image: jacketImg, rotate: -6 },
  { title: 'Red Leather Bag', size: 'ONE SIZE', brand: 'Coach', price: 45, shipping: 8, image: bagImg, rotate: 3 },
  { title: 'White Sneakers', size: 'SIZE 10', brand: 'Nike', price: 85, shipping: 12, image: sneakersImg, rotate: -2 },
  { title: 'Cream Knit Sweater', size: 'ONE SIZE', brand: 'Zara', price: 35, shipping: 7, image: sweaterImg, rotate: 5 },
];

const MarketRack = () => {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Pole */}
      <div className="absolute top-6 left-0 right-0 h-2 bg-foreground/80 rounded-full z-0" />

      {/* Cards on hangers */}
      <div className="relative z-10 flex justify-center gap-3 md:gap-5 pt-0 px-2">
        {cards.map((card, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{ transform: `rotate(${card.rotate}deg)` }}
          >
            {/* Hanger hook */}
            <div className="relative w-6 h-8 flex items-start justify-center">
              <div className="w-[2px] h-4 bg-foreground/50 rounded-full" />
              {/* Triangle hanger */}
              <svg
                viewBox="0 0 40 20"
                className="absolute top-3 w-10 h-5 text-foreground/40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 0 L38 18 H2 Z" />
              </svg>
            </div>

            {/* Listing Card */}
            <div className="w-[80px] md:w-[140px] bg-card rounded-xl md:rounded-2xl p-1 md:p-1.5 card-shadow mt-2">
              {/* Image */}
              <div className="aspect-[5/6] overflow-hidden rounded-lg md:rounded-xl">
                <img
                  src={card.image}
                  alt={card.title}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>

              {/* Content */}
              <div className="px-0.5 md:px-1 pt-1 md:pt-1.5 pb-0.5">
                <h3 className="text-[7px] md:text-[11px] font-semibold text-foreground truncate leading-tight">
                  {card.title}
                </h3>
                <div className="mt-0.5 md:mt-1 flex flex-nowrap gap-0.5 overflow-hidden">
                  <span className="rounded-full bg-tag px-1 md:px-1.5 py-px text-[5px] md:text-[8px] font-medium text-charcoal-light whitespace-nowrap">
                    {card.size}
                  </span>
                  <span className="rounded-full bg-tag px-1 md:px-1.5 py-px text-[5px] md:text-[8px] font-medium text-charcoal-light whitespace-nowrap truncate">
                    {card.brand}
                  </span>
                </div>
                <div className="flex items-end justify-between mt-0.5 md:mt-1">
                  <p className="text-[8px] md:text-xs font-bold text-foreground">${card.price}</p>
                  <p className="text-[5px] md:text-[8px] text-muted-foreground">+ ${card.shipping} 📦</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketRack;

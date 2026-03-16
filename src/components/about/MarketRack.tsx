import marketRackBanner from '@/assets/about/market-rack-banner.png';

const MarketRack = () => {
  return (
    <div className="w-screen relative left-1/2 -translate-x-1/2pt-10 md:pt-6 overflow-hidden">
      <img
        alt="Clothing items hanging on a market rack"
        className="w-[140%] max-w-none -ml-[20%] md:w-full md:ml-0 md:max-w-full h-auto block"
        draggable={false}
        src="/lovable-uploads/272555c1-22dc-4b5f-949b-19887da07f24.png"
      />
    </div>
  );
};

export default MarketRack;
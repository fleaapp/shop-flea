import marketRackBanner from '@/assets/about/market-rack-banner.png';

const MarketRack = () => {
  return (
    <div className="w-screen relative left-1/2 -translate-x-1/2">
      <img
        src={marketRackBanner}
        alt="Clothing items hanging on a market rack"
        className="w-full h-auto block"
        draggable={false}
      />
    </div>
  );
};

export default MarketRack;

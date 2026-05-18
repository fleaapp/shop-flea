const EMOJIS = ["👕", "👗", "👖", "👟", "👜", "🧥"];

const LaunchMarquee = () => {
  const items = Array.from({ length: 12 });
  return (
    <div className="w-full bg-secondary overflow-hidden">
      <div className="flex w-max animate-[marquee_60s_linear_infinite] py-1.5 md:py-2">
        {items.concat(items).map((_, i) => (
          <span
            key={i}
            className="flex items-center text-[hsl(var(--flea-navy))] font-bold tracking-[0.2em] text-xs md:text-sm whitespace-nowrap"
          >
            <span className="px-4">LAUNCHING MAY</span>
            <span className="px-4">{EMOJIS[i % EMOJIS.length]}</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default LaunchMarquee;

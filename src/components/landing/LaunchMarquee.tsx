const EMOJIS = ["👕", "👗", "👖", "👟", "👜", "🧥"];

const LaunchMarquee = () => {
  const items = Array.from({ length: 12 });
  return (
    <div className="w-full bg-secondary overflow-hidden">
      <div className="flex w-max animate-[marquee_60s_linear_infinite] py-1.5 md:py-2">
        {items.concat(items).map((_, i) => (
          <span
            key={i}
            className="px-6 text-[hsl(var(--flea-navy))] font-bold tracking-[0.2em] text-xs md:text-sm whitespace-nowrap"
          >
            LAUNCHING MAY <span className="mx-1">{EMOJIS[i % EMOJIS.length]}</span>
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

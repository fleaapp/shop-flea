const LaunchMarquee = () => {
  const items = Array.from({ length: 12 });
  return (
    <div className="w-full bg-[hsl(var(--flea-mint))] overflow-hidden">
      <div className="flex w-max animate-[marquee_30s_linear_infinite] py-1.5 md:py-2">
        {items.concat(items).map((_, i) => (
          <span
            key={i}
            className="px-6 text-[hsl(var(--flea-navy))] font-bold tracking-[0.2em] text-xs md:text-sm whitespace-nowrap"
          >
            LAUNCHING MAY ✦
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

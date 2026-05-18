const EMOJIS = ["👕", "👗", "👖", "👟", "👜", "🧥"];

const LaunchMarquee = ({
  size = "sm",
  variant = "mint",
}: {
  size?: "sm" | "md";
  variant?: "mint" | "navy";
}) => {
  const items = Array.from({ length: 12 });
  const textSize = size === "md" ? "text-sm md:text-sm" : "text-xs md:text-sm";
  const bg = variant === "navy" ? "bg-[hsl(var(--flea-navy))]" : "bg-secondary";
  const fg = variant === "navy" ? "text-[hsl(var(--flea-mint))]" : "text-[hsl(var(--flea-navy))]";
  return (
    <div className={`w-full ${bg} overflow-hidden`}>
      <div className="flex w-max animate-[marquee_60s_linear_infinite] py-4 md:py-5">
        {items.concat(items).map((_, i) => (
          <span
            key={i}
            className={`flex items-center ${fg} font-bold tracking-[0.2em] ${textSize} whitespace-nowrap`}
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

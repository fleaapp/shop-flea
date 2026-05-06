import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, delay },
});

const features = [
  { icon: <span className="text-2xl">↩️</span>, title: "Undo", description: "Changed your mind? Hit undo to bring back the last card you swiped away." },
  { icon: <SlidersHorizontal className="w-5 h-5 text-foreground" />, title: "Filter", description: "Narrow down your stack by size, colour, category, brand, price and more." },
  { icon: <span className="text-2xl">🔄</span>, title: "Refresh", description: "Swiped through everything? Refresh to reload all your passed listings back into the stack." },
  { icon: <span className="text-2xl">🔍</span>, title: "Search", description: "Looking for something specific? Search to filter your card stack by keyword, brand or item." },
  { icon: <span className="text-2xl">🧠</span>, title: "Algorithm", description: "The more you swipe, the more Flea learns what you like - and serves you better finds." },
];

const FeatureCard = ({ icon, title, description, delay }: { icon: ReactNode; title: string; description: string; delay: number }) => (
  <motion.div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-primary/5 md:flex-col md:items-center md:text-center md:px-4 md:py-5" {...reveal(delay)}>
    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 border-border bg-card flex items-center justify-center flex-shrink-0">{icon}</div>
    <div className="md:text-center">
      <h3 className="text-base font-black text-foreground mb-0.5 md:mb-2">{title}</h3>
      <p className="text-sm leading-relaxed text-foreground/80">{description}</p>
    </div>
  </motion.div>
);

const FeaturesGrid = () => {
  return (
    <section className="bg-secondary px-6 py-14 md:py-18">
      <div className="container mx-auto max-w-7xl">
        <motion.h2 className="text-lg font-black leading-relaxed md:text-xl text-center mb-10 text-foreground uppercase tracking-wider" {...reveal()}>
          You're in control
        </motion.h2>
        <div className="flex flex-col gap-3 md:grid md:grid-cols-5 md:gap-4">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} description={feature.description} delay={i * 0.06} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;

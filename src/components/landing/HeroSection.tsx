import { motion } from "framer-motion";
import heroCombinedGif from "@/assets/flea-landing/hero-combined.gif";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden pt-16 md:pt-24 pb-16 md:pb-24 px-6">
      <div className="container mx-auto max-w-6xl relative z-10">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <h1 className="text-[1.65rem] md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-navy">
            shop & sell secondhand
            <br />
            with a{" "}
            <span className="relative inline-block">
              swipe.
              <motion.svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 12"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
              >
                <motion.path
                  d="M2 8 C50 2, 150 2, 198 8"
                  stroke="hsl(120 100% 85%)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                />
              </motion.svg>
            </span>
          </h1>
          <p className="mt-8 md:mt-10 text-sm md:text-lg text-charcoal leading-relaxed max-w-lg mx-auto">
            Like your favourite Sunday flea market, but without the overpriced iced lattes, awkward small talk or having to even put on pants.
          </p>
          <div className="mt-6 flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled
              aria-label="Download Flea — coming May"
              className="flex items-center justify-center gap-2 bg-navy/20 rounded-xl w-[170px] py-3.5 cursor-not-allowed pointer-events-none"
            >
              <p className="text-navy/70 text-xs font-bold uppercase tracking-wide">📲 &nbsp; DOWNLOAD FLEA</p>
            </button>
            <p className="text-navy/60 text-[10px] font-semibold uppercase tracking-widest mt-1">COMING MAY</p>
          </div>
          <div className="-mt-8 md:-mt-6 flex justify-center -mx-6 relative">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90%] h-[68%] bg-navy rounded-3xl md:w-[40rem] lg:w-[44rem]" />
            <img
              src={heroCombinedGif}
              alt="Flea app showing swipe interface"
              loading="eager"
              decoding="async"
              className="relative z-10 block w-[130%] max-w-none md:w-full md:max-w-[50rem] lg:max-w-[58rem] mb-0"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;

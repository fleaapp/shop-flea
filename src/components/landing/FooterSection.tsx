import { motion } from "framer-motion";
import { Instagram, Twitter, Facebook, Download } from "lucide-react";
import { Link } from "react-router-dom";

const FooterSection = () => {
  return (
    <footer className="bg-navy px-6 pt-16 pb-8 md:pt-20 md:pb-10">
      <div className="container mx-auto max-w-xl text-center">
        <motion.h2
          className="text-2xl md:text-4xl font-black text-mint uppercase tracking-wider mb-2"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        >
          Find It On Flea
        </motion.h2>
        <motion.p className="text-mint/70 text-base md:text-lg mb-8" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}>
          Start Swiping
        </motion.p>

        <motion.div className="flex flex-col justify-center items-center gap-3 mb-10" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.4 }}>
          <a
            href="/install"
            className="flex items-center justify-center gap-2 bg-mint rounded-xl w-[220px] py-3.5 hover:opacity-90 transition-opacity"
          >
            <p className="text-navy text-xs font-bold uppercase tracking-wide">📲 Download Flea</p>
          </a>
          <div className="flex flex-row justify-center items-start gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled
                aria-label="Apple App Store — coming soon"
                className="flex items-center justify-center gap-2 bg-mint/30 rounded-xl w-[105px] py-3.5 cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-mint/60" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                <p className="text-mint/60 text-[11px] font-bold uppercase tracking-wide">App Store</p>
              </button>
              <p className="text-mint/50 text-[10px] font-semibold uppercase tracking-wide">Coming soon!</p>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled
                aria-label="Google Play — coming soon"
                className="flex items-center justify-center gap-2 bg-mint/30 rounded-xl w-[105px] py-3.5 cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-mint/60" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 010 1.38l-2.302 2.302L15.396 13l2.302-2.492zM5.864 2.658L16.8 9.99l-2.302 2.302L5.864 3.658z" /></svg>
                <p className="text-mint/60 text-[11px] font-bold uppercase tracking-wide">Play</p>
              </button>
              <p className="text-mint/50 text-[10px] font-semibold uppercase tracking-wide">Coming soon!</p>
            </div>
          </div>
        </motion.div>

        <motion.div className="flex justify-center gap-5 mb-10" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.4 }}>
          {[{ icon: Instagram, label: "Instagram" }, { icon: Twitter, label: "Twitter" }, { icon: Facebook, label: "Facebook" }].map(({ icon: Icon, label }) => (
            <a key={label} href="#" aria-label={label} className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-navy hover:opacity-90 transition-opacity">
              <Icon className="w-5 h-5" />
            </a>
          ))}
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-4 text-mint/50 text-xs">
            <a href="#" className="hover:text-mint transition-colors">Terms & Conditions</a>
            <span>·</span>
            <a href="#" className="hover:text-mint transition-colors">Privacy Policy</a>
          </div>
          <p className="text-mint/30 text-xs">© {new Date().getFullYear()} Flea. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;

import { useEffect } from "react";
import "@/styles/flea-landing.css";
import ScallopHeader from "@/components/landing/ScallopHeader";
import HeroSection from "@/components/landing/HeroSection";
import StickyFeaturesScroll from "@/components/landing/StickyFeaturesScroll";
import GestureCardsSection from "@/components/landing/GestureCardsSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import FAQSection from "@/components/landing/FAQSection";
import FooterSection from "@/components/landing/FooterSection";

const About = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Flea — Shop & sell secondhand with a swipe";
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="flea-landing min-h-screen" style={{ overflowX: "clip" }}>
      <ScallopHeader />
      <HeroSection />
      <div className="relative z-10"><StickyFeaturesScroll /></div>
      <div className="relative z-10"><GestureCardsSection /></div>
      <div className="relative z-10"><FeaturesGrid /></div>
      <FAQSection />
      <FooterSection />
    </div>
  );
};

export default About;

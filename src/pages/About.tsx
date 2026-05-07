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

    // Swap PWA manifest so adding /about to home screen creates a separate
    // standalone shortcut scoped to /about (not the full app).
    const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevHref = existing?.getAttribute('href') ?? null;
    if (existing) existing.setAttribute('href', '/about.webmanifest');

    // SEO meta description for marketing page
    let descTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = descTag?.getAttribute('content') ?? null;
    if (descTag) {
      descTag.setAttribute(
        'content',
        'Flea — Australia\'s swipe-to-shop secondhand marketplace. Browse, buy and sell preloved fashion in seconds.',
      );
    }

    // Canonical
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/about`;

    return () => {
      document.title = prevTitle;
      if (existing && prevHref) existing.setAttribute('href', prevHref);
      if (descTag && prevDesc) descTag.setAttribute('content', prevDesc);
      if (createdCanonical && canonical?.parentNode) canonical.parentNode.removeChild(canonical);
    };
  }, []);

  return (
    <div className="flea-landing min-h-screen" style={{ overflowX: "clip" }}>
      <ScallopHeader />
      <HeroSection />
      <div className="relative z-10"><StickyFeaturesScroll /></div>
      <div className="relative z-10"><FeaturesGrid /></div>
      <div className="relative z-10"><GestureCardsSection /></div>
      <FAQSection />
      <FooterSection />
    </div>
  );
};

export default About;

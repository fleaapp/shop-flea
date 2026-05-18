import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ScallopEdge from "./ScallopEdge";

const faqs = [
  {
    q: "How does Flea work?",
    a: "Flea is a swipe-first secondhand marketplace built for Australia. Instead of endless grids and search bars, you get one listing at a time, full-screen - so every piece gets its moment. Swipe right to add to your wishlist, left to pass, and up to open the full details (photos, condition, measurements, seller). The more you swipe, the smarter your feed gets - it learns your taste and only shows you things you'd actually wear.",
  },
  {
    q: "How does the swiping work?",
    a: "Four simple gestures. Swipe right to save a listing to your wishlist. Swipe left to pass - you won't see it again. Swipe up to open the listing for full details, more photos and to message the seller or buy. Swipe down to skip and send it to the bottom of your stack for later. That's it - no menus, no clutter, just you and the next piece.",
  },
  {
    q: "When is Flea launching?",
    a: "We're launching in Australia in May 2026. Sign up to the waitlist above to be one of the first inside - early users get 2 months of free listings plus first dibs before the app goes public.",
  },
  {
    q: "Where can I download Flea?",
    a: "Flea will be available on the Apple App Store, Google Play, and as a web app at finditonflea.com - so you can swipe from your phone, tablet or laptop. Join the waitlist and we'll email you the moment it goes live.",
  },
  {
    q: "What are the fees?",
    a: "Selling on Flea is FREE for May, June and July 2026 - zero selling fees while we launch. After that, sellers pay a flat 7% platform fee on the item price (one of the lowest in the market). Buyers cover the payment processing fee at checkout - around 1.7% with card or Apple/Google Pay, or 3% with PayPal. No listing fees, no monthly fees, no surprises.",
  },
  {
    q: "How does Flea learn my style?",
    a: "Every swipe is a signal. Flea quietly tracks the brands, sizes, categories, colours and price points you save versus pass, and tunes your feed in real time. You're not stuck with a generic 'For You' algorithm built for everyone - your stack is built from your actual behaviour, so the more you use it, the more it feels like a feed curated just for you.",
  },
];

const FAQSection = () => {
  return (
    <div className="relative z-10">
      <section className="bg-mint px-6 py-14 md:py-18">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-navy text-2xl md:text-3xl font-black text-center mb-8 uppercase tracking-wider">FAQ</h2>
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border border-navy/30 rounded-xl px-4 bg-mint">
                <AccordionTrigger className="text-navy text-left text-base md:text-lg font-bold hover:no-underline py-4">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-navy/85 text-sm md:text-base leading-relaxed pb-4">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      <ScallopEdge fillColor="hsl(120, 100%, 92%)" bgColor="hsl(234, 30%, 22%)" showTopLine={false} />
    </div>
  );
};

export default FAQSection;

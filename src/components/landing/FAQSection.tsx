import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ScallopEdge from "./ScallopEdge";

const faqs = [
  { q: "How does Flea work?", a: "Flea shows you one listing at a time, full-screen. Swipe right to save, left to pass, up for more details. No grids, no clutter - just the spotlight on each piece." },
  { q: "Will I see the same listings over and over?", a: "Nope. Once you swipe past a listing, it's gone from your feed. Every scroll is a fresh hunt - zero repeats, zero deja-vu. (Unless you undo or refresh passed listings.)" },
  { q: "What are the fees for selling?", a: "We've kept our cut fair so the post office run is actually worth it. Our fee structure is built to keep the profit in your pocket - not to fund another tech bro's yacht." },
  { q: "How does Flea learn my style?", a: "Every swipe trains Flea to learn your taste. Your feed is built on your actual behaviour - not generic suggestions or a lucky dip." },
  { q: "When is Flea launching?", a: "We're cooking. Sign up for early access to be the first to know when the app drops." },
  { q: "Where can I download Flea?", a: "Flea will be available on the App Store and Google Play. Join the waitlist to get notified at launch." },
];

const FAQSection = () => {
  return (
    <div className="relative z-10">
      <section className="bg-navy px-6 py-14 md:py-18">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-mint text-2xl md:text-3xl font-black text-center mb-8 uppercase tracking-wider">FAQ</h2>
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border border-mint/30 rounded-xl px-4 bg-navy">
                <AccordionTrigger className="text-mint text-left text-base md:text-lg font-bold hover:no-underline py-4">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-mint/85 text-sm md:text-base leading-relaxed pb-4">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      <ScallopEdge fillColor="hsl(234, 30%, 22%)" bgColor="hsl(120, 100%, 92%)" showTopLine={false} />
    </div>
  );
};

export default FAQSection;

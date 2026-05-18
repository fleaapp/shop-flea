import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ScallopEdge from "./ScallopEdge";

const faqs = [
  { q: "How does Flea work?", a: "Flea shows you one listing at a time, full-screen. Swipe right to save, left to pass, up for more details. No grids, no clutter - just the spotlight on each piece." },
  { q: "How does the swiping work?", a: "Swipe right to save a listing, left to pass, and up to see more details. Every swipe trains your feed." },
  { q: "When is Flea launching?", a: "We're cooking. Sign up for early access to be the first to know when the app drops." },
  { q: "Where can I download Flea?", a: "You'll be able to download Flea on Apple, Google, and as a web app." },
  { q: "What are the fees?", a: "FREE selling fees for May, June & July 2026! Buyers cover payment processing (around 1.7%). After that, fees for sellers will be 7%." },
  { q: "How does Flea learn my style?", a: "Every swipe trains Flea to learn your taste. Your feed is built on your actual behaviour - not generic suggestions or a lucky dip." },
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

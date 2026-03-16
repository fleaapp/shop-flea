import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { DollarSign, Send, Instagram, Twitter } from 'lucide-react';
import swipeRightWishlist from '@/assets/onboarding/swipe-right-wishlist.svg';
import swipeUpCart from '@/assets/onboarding/swipe-up-cart.svg';
import swipeLeftPass from '@/assets/onboarding/swipe-left-pass.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import fleaLogo from '@/assets/flea-logo-transparent.png';
import cutoutJacket from '@/assets/about/cutout-jacket.png';
import cutoutSneakers from '@/assets/about/cutout-sneakers.png';
import cutoutSweater from '@/assets/about/cutout-sweater.png';
import cutoutBag from '@/assets/about/cutout-bag.png';
import MarketRack from '@/components/about/MarketRack';

const About = () => {
  const navigate = useNavigate();
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) {
      toast.error('Please fill in all fields');
      return;
    }
    setSending(true);
    // Simulate send
    await new Promise((r) => setTimeout(r, 1000));
    toast.success('Message sent! We\'ll get back to you soon 💌');
    setContactName('');
    setContactEmail('');
    setContactMessage('');
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-[#DBFBD5] font-sans overflow-hidden">
      {/* Market rack banner - full width at the top */}
      <MarketRack />

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pt-12 pb-20 md:pt-20 md:pb-32">
        {/* Floating cutouts */}
        <img src={cutoutJacket} alt="" className="absolute -top-4 -left-8 w-32 md:w-48 opacity-60 rotate-[-15deg] pointer-events-none select-none" />
        <img src={cutoutSneakers} alt="" className="absolute top-8 -right-6 w-28 md:w-44 opacity-50 rotate-[10deg] pointer-events-none select-none" />
        <img src={cutoutBag} alt="" className="absolute bottom-4 -left-4 w-24 md:w-36 opacity-40 rotate-[20deg] pointer-events-none select-none" />
        <img src={cutoutSweater} alt="" className="absolute -bottom-8 -right-10 w-36 md:w-52 opacity-50 rotate-[-8deg] pointer-events-none select-none" />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <img alt="Flea" className="h-10 md:h-20 mx-auto mb-8" src="/lovable-uploads/8d52d6b9-59c0-490a-97c0-5ffab455f175.jpg" />
          <h1 className="text-2xl md:text-5xl font-extrabold leading-tight tracking-tight text-[#423d3d]">
            Shop & sell secondhand<br />with a swipe.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-[340px] md:max-w-lg mx-auto leading-relaxed">
            Flea is here to shake up the secondhand fashion scene with a swipe. <em>Literally.</em>
          </p>
          <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-[320px] md:max-w-md mx-auto leading-relaxed">
            Like your favourite Sunday flea market - without the overpriced iced lattes, awkward haggling, or having to even leave your bed.
          </p>
          <div className="mt-10 flex justify-center">
            <Button
              onClick={() => navigate('/auth')}
              className="h-12 px-6 rounded-full bg-foreground text-background font-semibold text-base hover:bg-foreground/90">
              Sign up now
            </Button>
          </div>
        </div>
      </section>

      {/* Tagline strip */}
      <div className="bg-foreground py-4 overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee">
          {Array.from({ length: 6 }).map((_, i) =>
          <span key={i} className="text-primary text-sm md:text-base font-semibold mx-8 tracking-wide">
              The future of fashion is circular.
            </span>
          )}
        </div>
      </div>

      {/* About blurb */}
      <section className="px-6 py-16 md:py-24 bg-card">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
            Thrifting, reimagined 🔄
          </h2>
          <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
            We've taken the thrill of thrifting, the joy of a good deal, and the mindless fun of swiping — and rolled it into one game-changing app.
          </p>
          <p className="mt-6 text-foreground font-semibold text-base md:text-lg">
            The future of secondhand fashion is circular, and it starts with you. 🌍
          </p>
        </div>
      </section>

      {/* How it works — Features */}
      <section className="px-6 py-16 md:py-24 bg-background">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Wishlist */}
            <div className="bg-foreground rounded-3xl p-6 text-center">
              <GestureDemo type="swipe-left-right" />
              <h3 className="font-bold text-cream text-base mt-4 mb-1">Swipe to Browse</h3>
              <p className="text-sm text-cream/70">Left to pass, right to save, up to cart</p>
            </div>
            {/* Tap */}
            <div className="bg-foreground rounded-3xl p-6 text-center">
              <GestureDemo type="tap" />
              <h3 className="font-bold text-cream text-base mt-4 mb-1">Tap to View</h3>
              <p className="text-sm text-cream/70">See full item details</p>
            </div>
            {/* Cart swipe */}
            <div className="bg-foreground rounded-3xl p-6 text-center">
              <GestureDemo type="cart-swipe" />
              <h3 className="font-bold text-cream text-base mt-4 mb-1">Manage Cart</h3>
              <p className="text-sm text-cream/70">Swipe to wishlist or delete</p>
            </div>
          </div>
        </div>
      </section>

      {/* Fair fees */}
      <section className="px-6 py-16 md:py-20 bg-card">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#ddfed7] flex items-center justify-center mb-6">
            <DollarSign className="h-8 w-8 text-foreground" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Fair Fees</h2>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            No hidden charges. No inflated commissions. Just fair, transparent pricing so sellers keep more and buyers pay less.
          </p>
        </div>
      </section>

      {/* App Store Buttons */}
      <section className="px-6 py-12 md:py-16 bg-background">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6">Get the app</h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#"
              onClick={(e) => {e.preventDefault();toast.info('Coming soon to the App Store! 🍎');}}
              className="inline-flex items-center justify-center gap-3 bg-foreground text-background rounded-xl px-6 py-3 font-medium text-sm hover:bg-foreground/90 transition-colors">
              
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
              App Store
            </a>
            <a
              href="#"
              onClick={(e) => {e.preventDefault();toast.info('Coming soon to Google Play! 🤖');}}
              className="inline-flex items-center justify-center gap-3 bg-foreground text-background rounded-xl px-6 py-3 font-medium text-sm hover:bg-foreground/90 transition-colors">
              
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.56.69.56 1.19s-.22.92-.57 1.19l-1.69.95-2.5-2.5 2.5-2.5 1.7.95M6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z" /></svg>
              Google Play
            </a>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="px-6 py-16 md:py-24 bg-card">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-2">Get in touch</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">Questions, feedback, or just want to say hi? 👋</p>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <Input
              placeholder="Your name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="h-12 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground" />
            
            <Input
              type="email"
              placeholder="Your email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-12 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground" />
            
            <Textarea
              placeholder="Your message"
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              className="min-h-[120px] rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground resize-none" />
            
            <Button
              type="submit"
              disabled={sending}
              className="h-12 w-full rounded-full bg-foreground text-background font-semibold hover:bg-foreground/90 gap-2">
              
              {sending ? 'Sending...' : 'Send message'} <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center mb-6">
            <img src={fleaLogo} alt="Flea" className="h-8 brightness-0 invert" />
          </div>
          
          {/* Socials */}
          <div className="flex justify-center gap-4 mb-6">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
              <Instagram className="h-5 w-5 text-background" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
              <Twitter className="h-5 w-5 text-background" />
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-background"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.7a8.18 8.18 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.13z" /></svg>
            </a>
          </div>

          {/* Links */}
          <div className="flex justify-center gap-6 text-xs text-background/50">
            <a href="#" onClick={(e) => {e.preventDefault();toast.info('Coming soon');}} className="hover:text-background/80 transition-colors">Terms & Conditions</a>
            <a href="#" onClick={(e) => {e.preventDefault();toast.info('Coming soon');}} className="hover:text-background/80 transition-colors">Privacy Policy</a>
          </div>

          <p className="text-center text-background/30 text-xs mt-6">
            © {new Date().getFullYear()} Flea. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Marquee animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>);

};

export default About;

import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

const SECTION = "scroll-mt-20";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 max-[375px]:pb-20">
      <header className="sticky top-0 z-40 bg-background px-4 py-4 flex items-center">
        <button
          onClick={() => navigate('/settings')}
          className="text-foreground absolute left-4"
          aria-label="Back to Settings"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-foreground text-center w-full">
          Terms & Conditions
        </h1>
      </header>

      <main className="px-5 max-[375px]:px-4 pt-2 pb-8 max-w-2xl mx-auto">
        <p className="text-xs text-muted-foreground mb-6">
          Last updated: 4 May 2026 · Version 1.0 · Governed by the laws of Australia
        </p>

        <article className="prose prose-sm max-w-none text-foreground space-y-6 leading-relaxed text-[15px]">
          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">1. About these Terms</h2>
            <p>
              Welcome to Flea ("<strong>Flea</strong>", "<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>"), a peer-to-peer secondhand fashion marketplace operated from Australia. These Terms & Conditions ("<strong>Terms</strong>") form a binding contract between you and Flea and govern your access to and use of the Flea mobile and web app, websites at finditonflea.com and any related services (together, the "<strong>Platform</strong>").
            </p>
            <p>
              By creating an account, browsing, listing an item, buying, selling, messaging another user or otherwise using the Platform, you confirm that you have read, understood and agreed to these Terms, our <button onClick={() => navigate('/privacy')} className="underline font-medium">Privacy Policy</button> and any additional policies referenced in them. If you do not agree, you must not use the Platform.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">2. Eligibility</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must be at least <strong>16 years old</strong> to create an account. Users aged 16-17 must have a parent or guardian's consent.</li>
              <li>You must be physically located in <strong>Australia</strong>. Flea is currently an Australia-only marketplace and accounts created outside Australia may be blocked or removed.</li>
              <li>You must provide accurate, current and complete information when registering and keep it up to date.</li>
              <li>You may only hold one personal account unless we expressly approve otherwise.</li>
              <li>If your account has been previously suspended or terminated by us, you may not register a new account without our written consent.</li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">3. Your account</h2>
            <p>
              You are responsible for keeping your login details, password and connected payment accounts secure and for all activity that occurs under your account. Notify us immediately at <a href="mailto:support@finditonflea.com" className="underline">support@finditonflea.com</a> if you suspect unauthorised access.
            </p>
            <p>
              You can update your profile, username, email, password, shipping settings, filter preferences and notification settings from <em>Settings</em> at any time. You may pause selling at any time via <em>Settings → Pause Selling</em>.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">4. The marketplace — our role</h2>
            <p>
              Flea is a venue that connects independent buyers and sellers of secondhand fashion items. We are <strong>not</strong> the seller, manufacturer, importer, owner or possessor of any item listed. Each contract of sale is formed directly between the buyer and the seller. Flea facilitates the listing, payment, messaging and dispute communication, but is not a party to the underlying sale contract except where expressly stated (for example, where we process a refund on a seller's behalf).
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">5. Listings and selling</h2>
            <p>By listing an item on Flea, you represent and warrant that:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You own the item and have the legal right to sell it.</li>
              <li>The item is genuine, authentic and not counterfeit, replica or stolen.</li>
              <li>The listing accurately describes the item including condition, brand, size, colour, defects and any included or excluded components, and the photos are of the actual item being sold.</li>
              <li>The item is not a prohibited item (see clause 6).</li>
              <li>The price is set in Australian dollars (AUD) and inclusive of any GST you may be required to remit.</li>
            </ul>
            <p>
              You are solely responsible for the accuracy of your listings, fulfilment of orders, packaging, dispatch within the timeframes set by Flea (see clause 9), responding to buyer questions and complying with all applicable Australian consumer laws including the <strong>Australian Consumer Law</strong> (Schedule 2 of the <em>Competition and Consumer Act 2010</em> (Cth)) and the consumer guarantees that apply to sales made in trade or commerce.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">6. Prohibited items and conduct</h2>
            <p>You must not list, sell, send, post or attempt to transact:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Counterfeit, replica or unauthorised reproductions of branded items;</li>
              <li>Stolen goods or goods obtained unlawfully;</li>
              <li>Items that infringe intellectual property, trade marks or moral rights;</li>
              <li>Underwear that has been worn, swimwear that has been worn without a hygiene liner, or any item in an unsanitary condition;</li>
              <li>Weapons, drugs, dangerous goods, hazardous materials, animals, body parts, recalled goods or any item prohibited under Australian law;</li>
              <li>Items containing hate symbols, sexually explicit content, or content that promotes violence, self-harm or discrimination.</li>
            </ul>
            <p>You must also not:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Harass, abuse, defame, threaten, stalk, dox or impersonate any person via messaging, comments or reviews;</li>
              <li>Circumvent the Flea checkout (for example, by directing a buyer to pay outside the Platform);</li>
              <li>Manipulate ratings, reviews or trending searches;</li>
              <li>Scrape, reverse engineer, automate access to or interfere with the Platform; or</li>
              <li>Use the Platform to send unsolicited commercial messages in breach of the <em>Spam Act 2003</em> (Cth).</li>
            </ul>
            <p>We may remove any listing, content or account, with or without notice, that we reasonably believe breaches these Terms.</p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">7. Buying</h2>
            <p>
              When you place an order through Flea checkout you agree to pay the listed price, the seller's shipping price and any applicable buyer service fee. Once payment is captured, a binding contract of sale is formed between you and the seller. Orders cannot be cancelled by buyers once placed, except where Flea or the seller agrees in writing or where required by law.
            </p>
            <p>
              Goods are sold "as described" by the seller. Because items are secondhand, minor wear consistent with the stated condition is to be expected. Your statutory rights under the Australian Consumer Law are not excluded.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">8. Fees and payments</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Platform fee:</strong> Sellers pay a 7% platform fee on the item price (excluding shipping) per completed sale.</li>
              <li><strong>Buyer service fee:</strong> Buyers pay a service fee on each order — currently 2% when paying by card via our card processor and 3% when paying via PayPal — added at checkout.</li>
              <li><strong>Instant payout:</strong> Sellers who choose an instant payout to their bank account pay an additional 1.5% instant payout fee charged by our payment processor.</li>
              <li><strong>Listing items:</strong> Listing items is free.</li>
            </ul>
            <p>
              All amounts are shown in AUD. Payments are processed by third-party providers (currently our card processor and PayPal) under their own terms. Flea does not store your full card or bank details. Payouts to sellers are made to the connected payment account in the seller's name; sellers are responsible for ensuring those details are accurate. Sellers are responsible for their own tax obligations including any GST and income tax. Fees may change on 30 days' notice via in-app notice or email.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">9. Shipping, tracking and delivery</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Sellers must dispatch sold items within <strong>3 business days</strong> and add valid Australian carrier tracking. Items not shipped within 6 days are flagged as overdue and may be auto-refunded to the buyer.</li>
              <li>Tracking is supported only for Australian carriers integrated with the Platform.</li>
              <li>Buyers can mark items as delivered. If tracking shows delivery, the order is treated as delivered for refund and review purposes.</li>
              <li>Risk in the goods passes to the buyer on delivery to the address provided at checkout.</li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">10. Refunds, returns and disputes</h2>
            <p>
              Buyers may request a refund through the order chat within <strong>10 days of delivery</strong> if the item is significantly not as described, damaged in transit, or never arrived. Sellers should respond promptly. Where a seller and buyer cannot resolve a dispute, Flea may, at its sole discretion, mediate and issue a refund (in whole or in part) from the seller's payout, but is not obliged to do so except where the Australian Consumer Law requires it.
            </p>
            <p>
              Nothing in these Terms excludes, restricts or modifies any consumer guarantee, right or remedy that cannot lawfully be excluded under the Australian Consumer Law.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">11. Reviews, comments and user content</h2>
            <p>
              You retain ownership of the photos, videos, descriptions, comments, reviews and messages you post ("<strong>User Content</strong>"). You grant Flea a worldwide, non-exclusive, royalty-free, sublicensable licence to host, store, reproduce, modify (for formatting), display and distribute your User Content for the purpose of operating, promoting and improving the Platform. You warrant that your User Content does not infringe the rights of any third party and is not misleading or deceptive.
            </p>
            <p>
              We may remove, edit or refuse to publish User Content that we reasonably consider breaches these Terms, applicable laws or community standards. Repeated breaches may result in account suspension or termination.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">12. Notifications and communications</h2>
            <p>
              By creating an account, you consent to receive transactional communications from us — including order updates, shipping reminders, payment alerts, security notices, refund updates and replies to your support requests — by in-app notification, push notification, email or SMS. These are necessary for the operation of your account and you cannot opt out while you have an active account, although you can disable push notifications via your device settings.
            </p>
            <p>
              You consent to receive marketing communications from us (e.g. product news and feature updates) by email or push. You can opt out at any time by using the unsubscribe link in any marketing email or turning off push notifications in <em>Settings</em>. We comply with the <em>Spam Act 2003</em> (Cth).
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">13. Pausing, suspending or terminating your account</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You may pause selling, log out, or request account deletion at any time via <em>Settings</em>.</li>
              <li>Account deletion is only available once you have no outstanding (non-delivered) orders and at least 14 days have passed since your most recent delivery, so that any refund or dispute window has closed.</li>
              <li>We may suspend or terminate your account immediately, with or without notice, if you breach these Terms, if we suspect fraud or unlawful activity, if a payment processor reverses or disputes a charge, if you remain inactive for an extended period, or if required by law.</li>
              <li>On termination, your live listings will be archived, your payouts (if any are due) will be processed in line with our payment processor's rules, and the licences you grant in clause 11 will continue for any User Content already shared with other users (for example, in past order chats and reviews).</li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">14. Intellectual property</h2>
            <p>
              The Platform, including its name, logos, design, software, illustrations and content (other than User Content) is owned by Flea or its licensors and protected by intellectual property laws. We grant you a limited, personal, non-exclusive, non-transferable, revocable licence to use the Platform for its intended purpose. All other rights are reserved.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">15. Disclaimers and liability</h2>
            <p>
              The Platform is provided "as is" and "as available". To the maximum extent permitted by law, we exclude all warranties not expressly set out in these Terms. We do not guarantee that the Platform will be uninterrupted, error-free, secure against attack, or that listings or other users will meet your expectations.
            </p>
            <p>
              Nothing in these Terms excludes, restricts or modifies any guarantee, right or remedy you have under the Australian Consumer Law or any other law that cannot be lawfully excluded. Where we are entitled to limit our liability under those laws for goods or services not of a kind ordinarily acquired for personal, domestic or household use or consumption, our liability is limited, at our option, to resupplying the services or paying the cost of having the services resupplied.
            </p>
            <p>
              Subject to the previous paragraph, to the maximum extent permitted by law our total aggregate liability to you for all claims arising out of or in connection with the Platform in any 12-month period is limited to the greater of (a) the total fees you paid to Flea in that period, or (b) AUD $100. We are not liable for indirect, special, incidental, punitive or consequential losses, loss of profits, loss of revenue, loss of goodwill or loss of data.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">16. Indemnity</h2>
            <p>
              You agree to indemnify and hold Flea, its officers, employees and contractors harmless from any claim, loss, damage, cost or expense (including reasonable legal fees) arising out of or in connection with: (a) your breach of these Terms; (b) your User Content; (c) your sale, purchase or use of any item listed on the Platform; or (d) your breach of any law or third-party right.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">17. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. If we make a material change, we will give you reasonable notice (for example, by in-app banner, push or email) before the change takes effect. Your continued use of the Platform after the change takes effect means you accept the updated Terms. If you do not agree, you must stop using the Platform and may delete your account.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">18. Governing law and disputes</h2>
            <p>
              These Terms are governed by the laws of New South Wales, Australia. You and Flea submit to the non-exclusive jurisdiction of the courts of New South Wales and the Commonwealth of Australia. Before commencing any court action, you agree to first contact us at <a href="mailto:support@finditonflea.com" className="underline">support@finditonflea.com</a> and attempt in good faith to resolve the dispute.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">19. Contact</h2>
            <p>
              Questions about these Terms? Contact us at <a href="mailto:support@finditonflea.com" className="underline">support@finditonflea.com</a> or via <em>Settings → Help Centre → Contact Support</em>.
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            © {new Date().getFullYear()} Flea. All rights reserved.
          </p>
        </article>
      </main>

      <BottomNav />
    </div>
  );
};

export default Terms;

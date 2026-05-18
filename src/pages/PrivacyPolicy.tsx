import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

const SECTION = "scroll-mt-20";

const PrivacyPolicy = () => {
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
          Privacy Policy
        </h1>
      </header>

      <main className="px-5 max-[375px]:px-4 pt-2 pb-8 max-w-2xl mx-auto">
        <p className="text-xs text-muted-foreground mb-6">
          Last updated: 4 May 2026 · Version 1.0 · Compliant with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles
        </p>

        <article className="prose prose-sm max-w-none text-foreground space-y-6 leading-relaxed text-[15px]">
          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">1. About this Policy</h2>
            <p>
              This Privacy Policy explains how Flea ("<strong>Flea</strong>", "<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>") collects, uses, stores, discloses and protects your personal information when you use the Flea app, websites at finditonflea.com and related services (the "<strong>Platform</strong>").
            </p>
            <p>
              We are bound by the <strong>Australian Privacy Act 1988 (Cth)</strong> and the <strong>Australian Privacy Principles (APPs)</strong>. By using the Platform you agree to your personal information being handled as described in this Policy.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">2. What personal information we collect</h2>
            <p>We collect personal information you provide directly, information generated when you use the Platform, and information from third parties such as our payment processors. This includes:</p>
            <p className="font-semibold mt-3">Account & profile</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name, username, email address, password (hashed), profile photo (avatar) and any biographical content you add.</li>
              <li>Date of account creation, last sign-in time, account status.</li>
              <li>Authentication identifiers (e.g. when you sign in with Google).</li>
            </ul>
            <p className="font-semibold mt-3">Listings, transactions & messaging</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Listings you create (photos, descriptions, brand, size, condition, price, tags).</li>
              <li>Orders, items in your cart, items in your wishlist, items you've passed on, your reviews and ratings.</li>
              <li>Messages, attachments and comments you send through buyer–seller chats, order chats, listing comments and support chats.</li>
              <li>Shipping address, recipient name, postcode, suburb, state for orders you place.</li>
              <li>Tracking numbers and carrier details for orders you fulfil.</li>
            </ul>
            <p className="font-semibold mt-3">Payment information</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identifiers issued by our payment partners (e.g. Stripe Connect account ID, PayPal merchant ID), payout status and onboarding status.</li>
              <li>Limited transaction metadata (amount, currency, timestamp, payment method, refund status).</li>
              <li>Webhook event data sent by payment partners (e.g. payment failures, disputes, refunds).</li>
              <li>We do <strong>not</strong> see or store your full card number, CVV or bank account number — those are collected directly by our payment partners.</li>
            </ul>
            <p className="font-semibold mt-3">Device & usage</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Device type, operating system, app version, browser, IP address, approximate location (for region detection) and language.</li>
              <li>Push notification subscription tokens (so we can send you alerts).</li>
              <li>Diagnostic logs, error reports and basic analytics about how you use the Platform (e.g. which screens you visit, search queries you make).</li>
            </ul>
            <p className="font-semibold mt-3">Support, reports & moderation</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Information you provide when you contact support, submit a suggestion, report a user, item or comment.</li>
              <li>Records of moderation actions taken on your account.</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              You can use the Platform without providing some optional information (e.g. a profile photo or biographical text), but core features such as buying, selling, messaging and payouts require the information set out above.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">3. How we collect personal information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Directly from you</strong> — when you sign up, complete your profile, list an item, place an order, message a user, contact support, or change your settings.</li>
              <li><strong>Automatically</strong> — when you use the Platform (device data, IP address, approximate region, page interactions, push token).</li>
              <li><strong>From third parties</strong> — Google (if you sign in with Google), Stripe and PayPal (account verification and payout status), AfterShip (delivery tracking), and OpenStreetMap (address autocomplete).</li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">4. Why we collect and use your information</h2>
            <p>We use your personal information to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Create and manage your account and authenticate you;</li>
              <li>Operate the marketplace — show listings to the right region, route messages, process orders, calculate shipping and platform fees;</li>
              <li>Process payments, payouts, refunds, chargebacks and disputes through our payment partners;</li>
              <li>Send transactional communications (order updates, shipping reminders, refund notices, security alerts, replies to your support requests);</li>
              <li>Send you marketing about Flea (with your consent, which you can withdraw at any time);</li>
              <li>Detect, prevent and respond to fraud, abuse, spam, prohibited listings, infringement, account takeover and other security threats;</li>
              <li>Moderate content and enforce our <button onClick={() => navigate('/terms')} className="underline font-medium">Terms & Conditions</button>;</li>
              <li>Improve the Platform — fix bugs, measure feature performance, develop new features;</li>
              <li>Comply with our legal obligations including under the Australian Consumer Law, the Spam Act 2003 (Cth) and tax laws.</li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">5. When we share your information</h2>
            <p>We share personal information only as needed to operate the Platform or as required by law:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>With other users</strong> — your username, profile photo, listings, ratings and reviews are public to other Flea users in your region. Buyers and sellers exchange shipping address and contact details necessary to complete an order.</li>
              <li><strong>With our service providers</strong> — including Supabase (hosting, database, authentication, storage), Lovable (app delivery), Stripe (card payments and seller payouts), PayPal (alternative payments), AfterShip (parcel tracking), Resend (transactional email), Google (sign-in), web push services run by Apple, Google and Mozilla, and OpenStreetMap (address lookup). These providers process data only on our instructions and under their own privacy obligations.</li>
              <li><strong>For legal reasons</strong> — to comply with a law, court order, regulator's request, or to protect our rights, property or safety, or those of our users or the public.</li>
              <li><strong>In a corporate transaction</strong> — if Flea is involved in a merger, acquisition or sale of assets, your information may be transferred subject to confidentiality obligations.</li>
              <li><strong>With your consent</strong> — for any other purpose disclosed at the time of collection.</li>
            </ul>
            <p>We do <strong>not</strong> sell your personal information to advertisers or data brokers.</p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">6. Cross-border data transfers</h2>
            <p>
              Some of our service providers store or process personal information outside Australia, including in the United States, the European Union and Singapore. Where we transfer your personal information overseas, we take reasonable steps to ensure the recipient handles it consistently with the Australian Privacy Principles, including by selecting reputable providers with strong data protection commitments and contractual safeguards.
            </p>
            <p>
              By using the Platform you consent to your personal information being transferred and stored overseas as described in this Policy. Note that, where you give such consent, APP 8.1 may not require us to take additional steps to ensure overseas recipients handle your information consistently with the APPs.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">7. How we store and protect your information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Personal information is stored on managed databases and object storage operated by our backend provider, with encryption in transit (TLS) and at rest.</li>
              <li>Passwords are hashed; we never store passwords in plain text.</li>
              <li>Access to production systems is restricted to authorised personnel and protected by row-level security, role-based access controls and audit logging.</li>
              <li>We use server-side input validation, content moderation, rate-limited and authenticated backend functions, and webhook signature verification for payment events.</li>
              <li>No system is perfectly secure. If a notifiable data breach occurs we will notify affected users and the Office of the Australian Information Commissioner (OAIC) in accordance with the Notifiable Data Breaches scheme under Part IIIC of the Privacy Act 1988 (Cth).</li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">8. How long we keep your information</h2>
            <p>
              We retain personal information for as long as you have an active account and for as long as we need it to fulfil the purposes set out in this Policy, comply with our legal, tax, accounting, dispute-resolution and audit obligations, and enforce our Terms.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Order, payment and refund records</strong> — retained for at least 7 years to comply with Australian tax and consumer law requirements.</li>
              <li><strong>Listings of deleted users</strong> — archived (hidden from discovery) but retained where they are linked to past transactions.</li>
              <li><strong>Messages tied to past orders</strong> — retained so both parties have access to a record of their transaction.</li>
              <li><strong>Reviews</strong> — public reviews you have posted may remain visible after your account is deleted, in anonymised form where reasonable.</li>
              <li><strong>Marketing data</strong> — deleted promptly after you unsubscribe.</li>
            </ul>
            <p>When personal information is no longer needed, we delete or de-identify it.</p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">9. Your rights and choices</h2>
            <p>Under the Australian Privacy Principles you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Access</strong> the personal information we hold about you;</li>
              <li><strong>Correct</strong> personal information that is inaccurate, out of date, incomplete, irrelevant or misleading;</li>
              <li><strong>Withdraw consent</strong> for marketing communications at any time;</li>
              <li><strong>Request deletion</strong> of your account and associated data, subject to the limits set out below;</li>
              <li><strong>Complain</strong> if you think we have breached the Australian Privacy Principles.</li>
            </ul>
            <p>You can exercise most of these rights directly in the app:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Update your profile, email, password, shipping settings and notification preferences in <em>Settings</em>.</li>
              <li>Pause selling at any time via <em>Settings → Pause Selling</em>.</li>
              <li>Disable push notifications via your device settings or <em>Settings → Notifications</em>.</li>
              <li>Delete your account via <em>Settings → Edit Profile → Delete Account</em>. Deletion is gated by a 14-day cooldown after your most recent delivery and requires that you have no outstanding orders, so dispute and refund rights are preserved.</li>
            </ul>
            <p>
              For any other request, email <a href="mailto:hello@finditonflea.com" className="underline">hello@finditonflea.com</a>. We will respond within a reasonable time (and within 30 days for access requests). We may need to verify your identity before acting. Some information cannot be deleted while we have legal obligations to keep it (for example, tax records of completed sales).
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">10. Marketing and communications</h2>
            <p>
              We send transactional messages (order updates, security alerts, support replies, refund notices, payment alerts) that are necessary to operate your account; you cannot opt out of these while you have an active account, although you can disable push delivery via your device settings.
            </p>
            <p>
              We send marketing messages (e.g. product news, feature launches) only with your consent. You can opt out at any time using the unsubscribe link in any marketing email or by contacting us. We comply with the <em>Spam Act 2003</em> (Cth) — every commercial electronic message we send identifies us as the sender and includes a working unsubscribe option.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">11. Cookies, local storage and tracking</h2>
            <p>
              We use cookies, local storage and similar device storage to keep you signed in, remember your preferences (e.g. dismissed onboarding tutorials, items you've passed on), measure basic usage and improve performance. We do not use third-party advertising cookies.
            </p>
            <p>
              You can clear cookies and local storage at any time using your browser or device settings. Some features of the Platform will not work correctly without them.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">12. Location information</h2>
            <p>
              We use your IP address (and, with your permission, your device's coarse GPS location) to confirm that you are accessing the Platform from Australia, because Flea is currently an Australia-only marketplace. We do not track your precise location and we do not use it for advertising.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">13. Children</h2>
            <p>
              The Platform is not intended for children under 16. We do not knowingly collect personal information from children under 16 without verifiable parental or guardian consent. If you believe a child has provided us with personal information, contact us and we will delete it.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">14. Third-party services</h2>
            <p>
              The Platform integrates with third-party services for specific functions. These services have their own privacy policies which we encourage you to read:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Stripe</strong> (card payments and seller payouts) — <a href="https://stripe.com/au/privacy" target="_blank" rel="noreferrer" className="underline">stripe.com/au/privacy</a></li>
              <li><strong>PayPal</strong> (alternative payment method) — <a href="https://www.paypal.com/au/legalhub/privacy-full" target="_blank" rel="noreferrer" className="underline">paypal.com/au/legalhub/privacy-full</a></li>
              <li><strong>Supabase</strong> (database, authentication, storage) — <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" className="underline">supabase.com/privacy</a></li>
              <li><strong>Google</strong> (Google sign-in) — <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline">policies.google.com/privacy</a></li>
              <li><strong>AfterShip</strong> (parcel tracking) — <a href="https://www.aftership.com/legal/privacy" target="_blank" rel="noreferrer" className="underline">aftership.com/legal/privacy</a></li>
              <li><strong>Resend</strong> (transactional email) — <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer" className="underline">resend.com/legal/privacy-policy</a></li>
              <li><strong>OpenStreetMap</strong> (address lookup) — <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer" className="underline">osmfoundation.org/wiki/Privacy_Policy</a></li>
            </ul>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">15. Changes to this Policy</h2>
            <p>
              We may update this Policy from time to time. The "Last updated" date at the top will reflect the most recent version. If we make a material change, we will notify you by in-app banner, push or email before it takes effect.
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-base font-bold mb-2">16. Complaints and contact</h2>
            <p>
              If you have a question, concern or complaint about how we handle your personal information, contact our Privacy Officer at <a href="mailto:hello@finditonflea.com" className="underline">hello@finditonflea.com</a>. We will acknowledge your complaint within 7 days and aim to resolve it within 30 days.
            </p>
            <p>
              If you are not satisfied with our response, you can lodge a complaint with the Office of the Australian Information Commissioner:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Web: <a href="https://www.oaic.gov.au" target="_blank" rel="noreferrer" className="underline">oaic.gov.au</a></li>
              <li>Phone: 1300 363 992</li>
              <li>Post: GPO Box 5288, Sydney NSW 2001</li>
            </ul>
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

export default PrivacyPolicy;

# FAQ Refresh Plan (Revised)

Update `src/components/FAQSection.tsx` to reflect the current product state. Use "payment provider" as the default term, only naming Stripe where it directly explains an in-app screen or link. Add the new payout timing guidance the user requested.

## Verified facts from the codebase

- Buyer fee: **4% + $0.70 Secure Checkout Fee** (`feeCalculator.ts`).
- Seller fees: **0%** — sellers keep full item + shipping.
- Payout schedule: daily with minimum delay (`stripe-connect-onboard` sets `interval: "daily"`, `delay_days: "minimum"`).
- Instant payout: **1.5% fee**, only after the seller's payment account is fully verified (`SalesDetailsSheet.tsx`).
- Refund window: **10 days after delivery**, or **30 days after order** if never delivered (`stripe-connect-refund`).
- Shipping reminders: **day-3 reminder**, **day-6 urgent reminder** (`shipping-reminders` edge function).
- Overdue flag: orders not shipped within **4 days** show as overdue in Sales.
- Guest mode: browse without an account; prompted to log in / sign up when trying to buy, sell, wishlist, etc.
- Auth: email/password plus Google sign-in via in-app browser; verification links open back in the app via universal links.
- Notifications: push + in-app alerts for sales, messages, shipping updates, reviews, refunds.

## Proposed payout wording (new)

Add to the "How do I get paid?" answer:

> Your first payout may take up to 7 days while your payment provider verifies your identity and bank details. This helps protect everyone from fraud. After that, payouts usually land within 24 hours. If you need funds faster, you can opt in to Instant Payout for a 1.5% fee once your account is fully verified.

## Proposed FAQ structure

Keep the existing categories. Revise entries and add new ones.

```text
🛍️ Buying
  - How do I buy an item?
  - Where do I find my Wishlist?
  - How do I remove an item from my Cart?
  - How do I pay for my order?                  (revise: card, Apple Pay, Google Pay via connected payment provider)
  - What fees do I pay as a buyer?              (keep: 4% + $0.70 Secure Checkout Fee)
  - Can I get a refund?                         (revise: 10-day window from delivery, request in order chat)
  - How do I confirm I've received an order?    (NEW: Mark as Delivered)
  - How do I message a seller?                  (NEW: order chat thread)

👕 Selling
  - How do I list an item for sale?             (revise: connect payment provider first)
  - What fees do I pay as a seller?             (keep: none)
  - How do I get paid?                          (revise: new 7-day / 24-hour / instant payout wording)
  - What does "Pause Selling" do?               (keep)
  - How long do I have to ship an order?        (revise: day-3 reminder, day-6 urgent, 4-day overdue flag)
  - How do reviews work?                        (NEW)
  - What does the ⏸️ on my listing mean?        (NEW: paused)
  - Can I mark an item as sold elsewhere?       (NEW)

🔍 Browsing & Filters
  - How do I filter listings?                   (keep)
  - What if I want an item I passed on?         (keep)
  - Can I search for specific items?            (keep)

📦 Shipping
  - How does shipping work?                     (keep)
  - How does tiered / combined shipping work?   (revise)
  - How is tracking handled?                    (NEW: AU carriers, auto status updates)

💳 Payments
  - How do I connect a payment method to sell?  (revise: in-app onboarding with our payment provider)
  - My account status says "Verifying" - what does that mean?   (revise)
  - What do "Pending review (🔍)" and "Action required (⚠️)" mean?  (NEW)
  - Where do I see my payouts and history?      (NEW: Seller Dashboard in Settings, opens provider dashboard in-app)

👤 Account & Privacy
  - How do I sign in?                           (NEW: email/password or Google, all in-app)
  - What is Guest Mode?                         (NEW)
  - I didn't get my verification email          (NEW: check spam, link opens back in app)
  - How do I change my email or password?       (keep)
  - Can I delete my account?                    (keep)
  - What happens to my listings if I delete my account?   (revise: auto-archived, removed in real time)
  - How do I report a user or listing?            (keep)

🔔 Notifications & Alerts   (NEW category)
  - What notifications will I get?                  (sales, messages, reviews, refunds, shipping updates)
  - How do I turn push notifications on/off?      (device settings + in-app toggle)
  - Why is there a green dot on Alerts?           (unread activity indicator)
```

## Style rules

- Inter, sentence case, **mandatory trailing full stop** on every answer.
- Short dashes (`-`), no em dashes.
- Use "payment provider" / "provider dashboard" by default. Mention Stripe only where it matches an existing UI label (e.g. "View order on Stripe" button, Stripe dashboard link).

## Files touched

- `src/components/FAQSection.tsx` — replace the `faqItems` array.

No schema, edge function, or other file changes.
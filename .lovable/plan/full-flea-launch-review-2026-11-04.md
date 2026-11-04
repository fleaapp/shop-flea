# Full Flea launch review

The goal is a full launch-readiness review of the whole app, not just security. Nothing gets changed until you see the report and pick what to fix.

## Quick answer: can a developer find my code and data?

- **App code on phones and the website:** anyone determined can read the app's screen code, because it runs on their device. That's true for every app, Depop and Vinted included. It's fine as long as no secrets live in it, and the review checks for exactly that.
- **Server code:** the code that handles payments, refunds and payouts runs on Flea's backend and can't be seen from outside.
- **GitHub:** your code is only public if the GitHub repository is set to Public. The review checks whether a repository is connected, and the report will tell you how to confirm it's Private.
- **Data:** people's emails, addresses, orders and payouts are protected by access rules on every table. The review re-checks every table.

## What gets reviewed

1. **Buyer journey:** sign-up and login, Home card stack, search, listing details, cart, wishlist, offers, checkout (Apple Pay and card), coupons, orders, tracking, reviews.
2. **Seller journey:** onboarding and verification, listing, editing, sales, shipping and tracking, seller dashboard, balance and payouts, bundle shipping, offers.
3. **Refunds and disputes (fairness):**
   - every route a refund can take: seller cancel, auto-refund when not shipped, buyer request, return before refund, admin decision, escalation
   - deadlines, who pays shipping, holding payouts during disputes, evidence rules
   - comparison with Depop, Vinted and the Australian Consumer Law
   - gaps where a buyer or seller could be treated unfairly or could game the system
4. **User safety:** scams and fake sellers, the bank-change cooling period, account blocking, reporting, harassment in comments and chat, privacy of activity and location, the age and ID process.
5. **Front end, UX and UI:** consistency with the lime and charcoal style, empty, loading and error screens, the keyboard on iPhone, buttons hidden under drawers, copy (short dashes, full stops, no "Stripe"), accessibility basics, speed and image loading.
6. **Backend and reliability:** background jobs, notifications (push, email, app icon badge), consistent seller availability, database rules, error logs, money totals adding up between checkout, the dashboard and admin.
7. **Security leftovers:** the remaining 2 critical and roughly 13 smaller scan findings.
8. **Launch and legal:** App Store and Google Play readiness, Terms, Privacy Policy, fee wording.

## The report

- **Must fix before launch:** problems that lose money, break trust, or put users at risk.
- **Should fix soon.**
- **Nice to have and opportunities.**
- **Checked and fine.**

Each item gets a plain explanation, an example of who it affects, and the suggested fix. You choose what to build after that.

## Technical details

- Run parallel read-only investigations: buyer flow, seller and payouts, refunds and disputes, safety and moderation, UI consistency, backend jobs and notifications, data access rules, and secrets in the app code. Re-check the GitHub connection.
- Compare server rules with what each screen shows, the same check that caught the inactive-seller bug.
- Report only what is confirmed in the code or data, and mark anything that needs a real iPhone test.

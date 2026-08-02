# Full Flea audit — verified findings and fix plan

Everything marked **verified** below was re-checked in the code and database in this session. Anything I could not prove without running the live app is written as an investigation step, not a claim.

## Closed since the last audit (verified)

- **Open endpoints** — payout, top-up, payment-intent, checkout, finalize-checkout, refund, ID upload and admin-data now reject requests from untrusted websites and are rate limited. A live test confirmed a fake website gets blocked while the real app passes through.
- **ID upload** — size is now checked before the file is loaded into memory, and the file's real signature is checked so only genuine photos are accepted.
- **Back buttons** — verified there is exactly one raw back call left in the whole app, and it lives inside the safe helper itself.
- **Money correctness** — fees, coupon code and coupon type are saved on the order and read back by receipts and refunds.

---

## Critical

Nothing release-blocking remains. The two items below are the most consequential correctness bugs.

**C1 — The seller never gets a "Delivered" alert**
Verified in the database function `notify_on_order_status_change`: the block is commented "Delivered notification to seller" but it inserts the alert against `NEW.buyer_id`. So only the buyer is told, and the seller — the person waiting on their money — hears nothing.
- Screens: Alerts, Sales, Seller Dashboard.
- User impact: sellers don't know their protection window has started, so they chase support instead.
- Business impact: avoidable support load and a trust gap on the payout timeline.
- Fix: send **two** delivered alerts — keep the existing buyer one ("your order arrived") and add a seller one worded for them ("your item was delivered, funds release in 48 hours"), each linking to the right drawer.
- Size: Small.

**C2 — Shipped alert wording contradicts itself and uses the retired emoji**
Verified: the bell alert (from the database) says "📦 Your order X is on the way! Tap for details." while the push says "Your order is on the way." with an ✈️ prefix. The 📦 emoji was supposed to be swept out of the app.
- Screens: Alerts, push notifications.
- User impact: two different messages for one event looks unfinished.
- Business impact: brand inconsistency on the highest-visibility notification.
- Fix: one shared wording, ✈️ everywhere, and include the item name in both.
- Size: Small.

*Note on the previously suspected duplicate shipped push: verified it is **not** duplicated. The database inserts the bell row and the app sends the push — one of each. Wording is the only issue.*

---

## High priority

**H1 — Heavy list queries**
Verified: reviews, listings, home feed, favourites, seller profile, comments, edit screens and chat all request every column. Several caps are very high (reviews 200, listings 500, favourites 100) and none of the main lists page.
- Screens: Wishlist, Profile, Reviews, Seller Profile, Home.
- User impact: slow first paint, worse on mobile data.
- Business impact: bounce on the screens that drive repeat buying.
- Fix: name the columns each screen uses and add proper paging to favourites, reviews and listings.
- Size: Medium.

**H2 — Public profiles expose an exact last-active time**
Verified: `SellerProfile` reads `last_sign_in_at` from the public profile and uses the exact timestamp.
- User impact: strangers can see when someone is online or away.
- Business impact: privacy complaint risk; neither Depop nor Vinted expose this.
- Fix: coarsen to "active this week" or remove it.
- Size: Small.

**H3 — Buyer self-declared delivery routing (needs a live check)**
The admin review queue exists and the server function sets the review flag, but I have not proved end-to-end that an untracked order marked delivered by the buyer lands in review rather than releasing funds.
- Fix: place a test order, mark it delivered as the buyer without tracking, confirm it appears in the admin queue and funds stay held. Fix only what the test exposes.
- Size: Small to check, Medium if broken.

**H4 — Remaining wildcard-origin endpoints**
Verified: 43 back-end functions still allow any website; 9 are locked down and 13 are rate limited. The money and admin ones are done, but the rest (profile, listing, messaging, push, email) are still open.
- Fix: move the remaining functions onto the shared origin helper; add rate limits to the write-heavy ones (comments, messages, reports, contact form).
- Size: Medium.

---

## Medium priority

**Orders, refunds and shipping**
- A bundle shows one combined status, so a partial refund inside it is invisible to the buyer.
- Tracking numbers are only checked for existence, so nonsense is accepted.
- A partially failed refund leaves items stuck behind a generic error.
- The bundle discount label vanishes silently when no percentage is set.
- No "where is my parcel" view — buyers see a status word, not a tracking history.

**Notifications**
- Opening Alerts marks everything read, including items never scrolled to (verified: `markAllAsRead` fires on open).
- Two notification types (final shipping warning, buyer overdue) have no in-app wording, emoji or tap destination.
- Cart, Profile and Alerts each compute their own badge alongside the shared system, so numbers can disagree.

**UI and consistency**
- Verified: 55 files hardcode colours instead of using the design system, which is why some screens drift.
- Verified: Home, Cart, Profile, Seller Profile, Auth, Order Chat and Checkout Success have no main page heading, unlike the other 22 screens.
- Listing Details shows two equal-weight buttons with no clear primary action.
- Empty, loading and error states differ per screen, and no list screen has a "something went wrong, retry" state.
- Contact Support uses tappable boxes rather than real buttons.
- Several icon buttons fall under the 44px minimum tap size (Profile, Wishlist, Comments, Coupon input).
- Password rules appear one error toast at a time instead of all at once.

---

## Nice to have

- Saved-card selection at checkout is offered but not reusable in one tap.
- Seller analytics: views, saves, conversion.
- Prohibited items FAQ and a named external dispute pathway.
- Make-an-offer.

## Benchmark

At or above standard: buyer protection window, bundle shipping, the swipe feed, live-camera refund proof, in-app-only seller onboarding.
Behind: no make-an-offer (expected on Depop and Vinted), no seller analytics, no parcel tracking view, thinner empty and error states.

## Legal, copy and FAQ

The earlier pass reconciled FAQ, Terms and Privacy on dispatch deadlines, verification gating, record keeping, GST, 18+ selling age and camera permissions, and those still hold. The open risk is the delivered/dispute wording: if H3 turns out to release funds early, in-app behaviour would contradict the published protection window.

## Overall product health score

**87/100.** Up from 84. Security and money correctness are in good shape. What is left is notification correctness, list-screen performance, and a consistency sweep — real work, but nothing that breaks trust at the point of payment.

---

## Build order

1. **C1 + C2** — delivered alert to both buyer and seller, and shipped wording. Small, high visibility.
2. **H3** — live delivery-review check, then fix what it exposes.
3. **H2 + H1** — last-active leak, then column slimming and paging.
4. **H4** — remaining endpoints onto the shared origin helper plus rate limits on write-heavy ones.
5. **Notification sweep** — single badge source, scroll-aware read, missing wording for the two orphan types.
6. **Design system sweep** — colour tokens, tap targets, page headings, shared empty/loading/error components, primary action on Listing Details.
7. **Feature gaps** — parcel tracking view, then offers and seller analytics.

## Technical detail

C1 is a database migration replacing `notify_on_order_status_change` so the delivered branch inserts two rows — one for `buyer_id` and one for `seller_id`, with distinct titles and messages — plus a matching seller push and a Sales-drawer tap destination in `Notifications.tsx`. C2 aligns the push text in `useOrders.ts` with the database wording. H1 means explicit column lists and range-based paging in `useFavoriteListings`, `useReviews`, `useListings`, `useHomeFeed` and `SellerProfile`. H2 means dropping `last_sign_in_at` from `profiles_public` or bucketing it server-side. H4 reuses `_shared/cors.ts` and `_shared/rateLimit.ts` already in place. Badge unification means Cart, Profile and Alerts all read from `useNavBadges`.

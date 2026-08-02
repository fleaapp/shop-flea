Full end-to-end audit of Flea. Everything below marked "verified" was re-checked in the code and database this turn. Anything I could not confirm without running the app is marked "needs a live check" and is written as an investigation step, not a claim.

## Since the last audit — now confirmed fixed

- Money correctness: checkout saves the real fee, coupon code and coupon type on every order; receipts, refunds and pro-rata math read the saved number. FREEFLEA no longer shows phantom fees.
- Lost parcel: buyers can request a refund from "shipped" after the quiet period, enforced both in the app and on the server.
- Back buttons: verified there is exactly one raw back call left in the whole app, and it lives inside the safe helper itself. Twelve screens now use the safe helper.
- Payout double-send, admin endpoint lockdown, and the fee-copy corrections all still hold.

## Critical (fix before release)

**C1 — Money-moving and admin endpoints have no rate limit and accept requests from any website**
Verified: 50 back-end functions send a wildcard "any origin allowed" header, and only 7 of them use the rate-limit helper. Payout, top-up, payment-intent and the admin data endpoint are all in the unprotected group.
- Screens: Checkout, Seller Dashboard, Admin.
- User impact: none visible day to day, but a scripted attacker can hammer payout or checkout.
- Business impact: card-testing fraud, forced provider rate limits, potential account suspension.
- Fix: lock the allowed origin to the real app domains plus the native app origin; add the existing rate-limit helper to payout, top-up, payment-intent, finalize-checkout, refund and admin-data.
- Size: Medium.

**C2 — ID upload accepts any file and decodes it before checking the size**
Verified in the upload function: the file is fully decoded into memory first, then the 8MB check runs, and nothing verifies the file is actually an image.
- Screens: Seller verification.
- User impact: a large or corrupt file can hang or crash the step with no useful message.
- Business impact: memory exhaustion on the server; junk documents sent to the payment provider slow verification.
- Fix: check the declared length before decoding, verify the file signature is JPEG/PNG/HEIC, and reject anything else with a plain-English message.
- Size: Small.

## High priority

**H1 — Heavy list queries fetch every column with no page limit**
Verified: favourites, reviews, wishlist, listings and the home feed all request every column, and several have no limit.
- User impact: slow first paint on Wishlist, Profile and Reviews, worse on mobile data.
- Business impact: bounce on the two screens that drive repeat buying.
- Fix: name the columns each screen actually uses, add paging to favourites, reviews and wishlist, and batch the admin threads query into one call.
- Size: Medium.

**H2 — Buyer self-declared delivery routing (needs a live check)**
The admin review queue exists and the server function sets the review flag, but I have not confirmed end to end that a buyer tapping "delivered" on an untracked order lands in review rather than releasing funds.
- Fix: step one is to place a test order, mark it delivered as the buyer without tracking, and confirm it appears in the admin queue and funds stay held. Fix only what that test exposes.
- Size: Small to investigate, Medium if broken.

**H3 — Possible duplicate "Order Shipped" alert (needs a live check)**
Both the database and the app can produce this notification. I found the type referenced in five places across app and server code but could not prove a duplicate fires without sending one.
- Fix: send a real shipped notification, count what arrives, then remove the losing sender and add a dedupe key.
- Size: Small.

**H4 — Public profile leaks an exact last-active timestamp**
Verified: the public profile view exposes last sign-in time to anyone.
- User impact: strangers can tell when someone is online or away.
- Business impact: privacy complaint risk; not something Depop or Vinted expose.
- Fix: coarsen to "active this week" or drop it from the public view.
- Size: Small.

## Medium priority

**Orders and refunds**
- A bundle shows one combined status, so a partial refund inside it is invisible to the buyer.
- Tracking numbers are only checked for existence, so nonsense is accepted.
- A partially failed refund leaves items stuck behind a generic error.
- The bundle discount label vanishes silently when no percentage is set.

**Notifications**
- Opening Alerts marks everything read, including items never seen.
- Two notification types (final shipping warning, buyer overdue) have no in-app wording, emoji or destination.
- The delivered push goes to the buyer when the seller is the one who needs it.
- Cart, Profile and Alerts each compute their own badge alongside the shared system, so numbers can disagree.

**UI and consistency**
- Verified: 32 files hardcode colours instead of using the design system, which is why some screens drift.
- Listing Details shows two equal-weight buttons with no clear primary action.
- Empty, loading and error states differ per screen, and no list screen has a "something went wrong, retry" state.
- Contact Support uses tappable boxes rather than real buttons.
- Several icon buttons fall under the 44px minimum tap size (Profile, Wishlist, Comments, Coupon input).
- Verified: Home and Cart have no main page heading, unlike the other 20 screens.
- Password rules appear one error toast at a time instead of all at once.

## Nice to have

- Saved-card selection at checkout is offered but not reusable in a single tap.
- Seller analytics: views, saves, conversion.
- A proper "where is my parcel" tracking view instead of a status word.
- Prohibited items FAQ and a named external dispute pathway.

## Benchmark against Depop, Vinted and eBay

At or above standard: buyer protection window, bundle shipping, the swipe feed, live-camera refund proof.
Behind: no make-an-offer (expected on both Depop and Vinted), no seller analytics, no parcel tracking view, thinner empty and error states.

## Legal, copy and FAQ

The previous pass reconciled FAQ, Terms and Privacy on dispatch deadlines, verification gating, record keeping, GST, 18+ selling age and camera permissions, and those still hold. The one open risk is the delivered/dispute wording: if H2 turns out to release funds early, the in-app behaviour would contradict the published buyer protection window, which is the kind of mismatch that draws complaints.

## Overall product health score

**84/100.** Up from 79. The release-blocking money and security holes are closed and totals now match what buyers are charged. What is left is hardening (open endpoints, upload validation), performance on the list screens, and a consistency sweep — real work, but none of it is a trust-breaking bug.

## Suggested build order

1. C1 and C2 — endpoint hardening and upload validation.
2. H2 and H3 — live checks on delivery review and duplicate push; fix whatever they expose.
3. H1 and H4 — query slimming, paging, and the last-active leak.
4. Notification correctness sweep: single badge source, missing wording, delivered recipient, scroll-aware read.
5. Design system sweep: colour tokens, tap targets, page headings, shared empty/loading/error components, primary action on Listing Details.
6. Feature gaps: offers first, then seller analytics and the parcel tracking view.

## Technical detail

Origin allow-list belongs in the shared CORS helper so all 50 functions inherit it; rate limiting reuses the existing `check_and_record_rate_limit` helper already wired into 7 functions. Upload validation should read the declared byte length from the base64 header before decoding and match the first bytes against known image signatures. Query slimming means explicit column lists plus range-based paging in `useFavoriteListings`, `useReviews`, `useListings` and `useHomeFeed`. Badge unification means Cart, Profile and Alerts all read from `useNavBadges` rather than recomputing.

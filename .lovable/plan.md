# Flea - Full Product Audit

This audit is based on the live database, the current code, and the error log. Where something could not be confirmed by a read, it is flagged as "needs checking" rather than stated as fact.

## What is already in good shape

Verified during this audit, so these are not issues:

- Money and policy wording line up. Buyer fee (4% + $0.70), seller fee (2% + $0.50), 3-day dispatch, 8-day auto refund, 48-hour delivery dispute window, 72-hour seller response - all identical in Terms and FAQ.
- Data is clean. No stuck pending orders, no expired offers left open, no overdue unshipped sales, no seller carrying a negative balance, no listing showing as active while it has a live order.
- Offer rules hold up. Accepting an offer re-clocks it to 24 hours, blocks acceptance if the seller turned offers off or the item is gone, and adds the item to the cart at the agreed price. Expired offers cannot be used at checkout.
- Listings that sell, pause, or get refunded automatically cancel any open offers on them.
- Icon-only buttons all carry screen-reader labels, and empty states, offline banner, error boundary and loading skeletons all exist.

## Critical issues (fix before release)

**1. Buyers are never told their offer died.**
When a seller sells, pauses, or removes an item, every open and accepted offer on it is silently switched to expired. No alert is sent. A buyer who was mid-negotiation, or who had an accepted offer sitting in their cart, simply finds it gone. This is the single most trust-damaging gap found.
Fix: send an alert ("The seller's item is no longer available, so your offer was cancelled") whenever offers are voided this way.

**2. Repeat app crashes are being logged and nobody is acting on them.**
The error log shows real crashes on real devices: four "Render crash" events, plus crashes from missing code (`formatTime`, `anyStillClearing`) and 22 combined "module script failed / Load failed" events, which are people on an old app version after a release.
Fix: treat the stale-version reload path as a release checklist item, and add an admin alert when any crash repeats more than twice in a day so these do not sit unnoticed again.

**3. Price changes do not cancel offers.**
Offers are only cancelled when a listing's status changes. If a seller drops the price after accepting an offer, the buyer can still be locked into the older, higher agreed price.
Fix: cancel or re-quote open and accepted offers when a listing's price changes, and tell the buyer.

## High priority

**4. Ninety database warnings from the security scanner.**
Almost all are the same pattern: internal database helper functions that a signed-out visitor can call. Most are harmless, but they have never been individually reviewed.
Fix: go through the list once, lock down the ones that should be sign-in only, and record the safe ones in security memory so future scans stay quiet.

**5. Loading states are lopsided.**
The admin area has proper skeletons everywhere. Buyer and seller screens mostly do not, so slow connections show blank space instead of an obvious "loading" state.
Fix: apply the existing PageSkeleton to the main buyer and seller screens.

**6. Push notification diagnostics are logged as warnings.**
Routine push setup steps ("setup-started", "token-received") make up over 50 of the last 30 days of log entries, which buries the genuine errors.
Fix: drop these to a debug level or stop logging them, so the error log shows only things that need attention.

## Medium priority

**7. Offer expiry is invisible until it lapses.** Buyers see the 24-hour payment window only inside the Offers screen. Add a reminder alert a few hours before an accepted offer expires.

**8. No warning before an item leaves a cart.** If a listing sells to someone else, the cart shows it as sold, but the shopper is not actively told. A single alert when a cart item sells would prevent a wasted checkout attempt.

**9. Seller-side clarity on held funds.** Funds release 48 hours after delivery, but the reason a specific payout is being held is only shown in some places. Show the same plain-English reason and release date wherever a held amount appears.

## Nice to have

**10. Saved searches and back-in-stock style alerts** - the table exists but is not surfaced to users.
**11. Order chat quick replies** for the most common seller messages ("Posted today", "Sending tomorrow").
**12. Seller performance summary** - dispatch speed and refund rate, which is what Depop and Vinted use to build buyer confidence.

## Needs checking before I can call it

These could not be confirmed by reading code or data alone and need a run-through on a device:

- Whether a shopper mid-checkout is blocked cleanly if the item sells in that moment.
- Whether Apple Pay totals and the on-screen total match on every bundle combination.
- Whether push notifications open the correct screen for every alert type.

## Scores

**Overall product health: 82/100.** The money, policy and marketplace rules are solid and consistent, which is the hard part. Points come off for silent offer cancellations, unreviewed crash reports and uneven loading states.

**Launch readiness: ready after the three critical fixes.** Nothing found blocks payments or breaks the core buy-sell loop today.

- **Top launch blockers:** silent offer cancellation, unreviewed repeat crashes.
- **Highest-risk payment issue:** stale-version app loads failing during a release window.
- **Highest-risk legal issue:** none found - fee and refund terms match the product exactly.
- **Highest-risk UX issue:** buyers losing an accepted offer with no explanation.
- **Quick wins:** the offer-cancelled alert, the cart-item-sold alert, and buyer-side loading skeletons. All three are small and all three directly protect conversion and trust.

## Technical notes

- Offer voiding happens in the `void_offers_on_listing_change` trigger; it updates status only and inserts no notification row. Fix belongs there or in an edge function called alongside it.
- Price-change voiding needs the same trigger widened from a status-only condition to include price.
- Crash grouping already exists in the admin error log; the alerting threshold is the missing piece.
- Push diagnostic entries are written at `warning` severity from the native push setup path and should be lowered.

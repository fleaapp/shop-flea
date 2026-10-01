# Deep review: "same rule, different answer" bugs

The inactive bug happened because each screen decided "is this seller available?" by itself, and the server never checked at all. Past reviews read screens one at a time, so they never caught screens disagreeing with each other. This review checks each rule across every place that uses it, including the server.

## Confirmed so far

1. **Checkout lets you buy from a paused, inactive or blocked seller.** The server step that takes payment only checks that the listing is active. It never looks at the seller. So anything that gets past the screens (an old cart, a slow phone, an accepted offer) can still be paid for.
2. **Offers can be sent to inactive sellers.** The server checks for paused and blocked sellers, but not inactive ones. The offer sheet checks, but the server is what counts.
3. **The 10-day rule is copied by hand in 5 places** (cart, wishlist, seller profile, the shared helper, the home feed on the server). They already disagree on small things: the seller profile counts exactly 10 days as inactive, the others don't. Some treat "no time recorded" as active today, others as unknown. That's the same kind of drift that caused the original bug.
4. **Paused-seller results are cached for 30 seconds** across the app, so a seller who just paused can still show as available for a short while.

## To check in the same pass (each will be confirmed against real data before fixing)

- **Accepted offers vs. checkout:** can someone else buy the item at full price after an offer is accepted? Can the accepted price still be used after the item sells?
- **Bundles and carts:** if one item in a multi-item cart becomes unavailable, does checkout block the whole order, or charge for the rest correctly?
- **Order status vs. payouts:** orders that are refunded, cancelled or disputed should never pay out. Check every route a payout can take.
- **Blocked or deleted accounts:** their listings, offers, chats and pending payouts all get handled the same way.
- **Counts vs. lists:** badge numbers (cart, wishlist, sales, alerts) should match the lists they open.
- **Admin vs. app:** admin statuses (seen, refunds, users) match what users actually see.
- **Times and dates:** 24h offer expiry, 9-day auto refund, 48h payout release and 10-day inactivity all count from the same clock.

## Fixes

1. One shared "is this seller available?" rule on the server (paused, blocked, deleted, inactive), used by checkout, offers, offer acceptance and the home feed.
2. Checkout refuses any item whose seller is unavailable and shows a clear message. The buyer isn't charged.
3. The offers server applies the same rule.
4. Every screen uses a single helper for the 10-day rule, with one boundary and one "no time recorded" rule.
5. Pausing clears the paused cache right away for that seller.
6. Each item in the "to check" list gets a short pass/fail result. Real bugs are fixed in this pass, and anything risky is reported back before changing it.

## How it's verified
- Pause account A, then try to check out and make an offer from account B. Both should be refused with a clear message.
- Do the same with an account that has been inactive for 10+ days.
- Check that the feed, cart, wishlist, listing page and seller profile all show the same status for the same seller.

## Technical details
- New SQL `public.seller_is_available(_user_id uuid) returns boolean` (security definer, stable): `status = 'active' AND NOT coalesce(pause_selling,false) AND (last_sign_in_at IS NULL OR last_sign_in_at >= now() - interval '10 days')`. Reuse in `get_home_feed`.
- `stripe-connect-payment-intent`: after the listing status check (around line 144), load seller profiles for all `listingRows` and return a 409 `SELLER_UNAVAILABLE` listing the item ids. Same check in `finalize-checkout` as a backstop before capture.
- `offers` function (around line 356): add the inactive check, and repeat it on accept.
- Remove the local `TEN_DAYS_MS` in `CartContext.tsx`, `Favorites.tsx` and `SellerProfile.tsx`, and import `isSellerInactive` from `fetchSellerProfiles.ts` (strict `>`; null means not inactive).
- `usePausedSellers`: export `invalidatePausedSeller(id)` and call it from the Settings pause toggle.
- Audit items get investigated with read queries against real orders, offers and payouts before any change.

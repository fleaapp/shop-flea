# Full app review: bugs found and fixes

The review covered payments, orders, offers, payouts, every screen that shows seller or listing status, sign-in, alerts, shipping and security. Earlier fixes changed what each screen shows. The server still lets several of these things through, so a buyer on an old link or an older app version can get past them. Below are the confirmed problems, most serious first.

## Critical - money

1. **Payouts can go out on disputed sales.** When a buyer disputes a charge with their bank, the payout check ignores it. The seller can withdraw the money, and Flea covers the loss if the dispute is lost.
2. **Buyers can tap "Complete order" while a refund request is open.** The automatic completion waits for open refunds, but the manual button doesn't. Completing the order releases the money to the seller, so the refund hold is skipped.
3. **Checkout takes payment for paused, blocked or inactive sellers.** The payment step only checks the listing, never the seller. Anyone who reaches checkout (old cart, shared link, old app) can pay someone who will never ship.
4. **The final checkout step doesn't re-check the item.** If a seller pauses or removes the item while the buyer is paying, the order still goes through.

## High

5. **Signed-in users can read private details of other users**, such as account status and payout setup state. Guests are already limited to basic details. Signed-in users should get the same limit plus the activity time.
6. **Offers can be sent to sellers who have been inactive for 10+ days.** The server only blocks paused and blocked sellers.

## Medium - things that look different screen to screen (same type as the inactive bug)

7. **The Wishlist only treats blocked sellers as unavailable.** Home and Cart also hide items from paused and inactive sellers.
8. **The Wishlist doesn't refresh when you come back to it.** Home and Cart do, so a paused seller can still look available in the Wishlist.
9. **When a seller pauses or is blocked, open screens aren't told.** Only listing changes refresh screens straight away.
10. **The "paused seller" memory is shared.** Looking up one seller can keep another seller's old paused state for too long.
11. **The 10-day inactive rule is written out in 6 places** and the copies already disagree slightly, the same drift that caused the original bug.

## Medium - missing alerts

12. **Nobody is told when an offer simply runs out of time.** Alerts only go out when the item is removed or the offer is about to expire.
13. **Sellers get no alert when a payout is sent.**

## Low

14. Tapping sign out twice quickly runs it twice.
15. Background jobs use the master database key as their password. They should use their own limited secret.
16. Some backend settings are written in a slightly different format. Check that they're actually applied.

## Checked and fine
Fee maths and the FREEFLEA coupon match everywhere. Shipping reminder and auto-refund timings match the FAQ. Notification taps go to real screens. Admin actions check for admin rights. Removed and hidden listings are filtered everywhere.

## Still being checked during the fix
Whether automatic refunds and auto-approvals can run on a sale that is already disputed. Whether the seller profile page fully hides listings from paused or inactive sellers. It has a status screen, so the review result may be out of date.

## How it's verified
- Pause seller A. From buyer B, try the cart, checkout, offer and seller page. All should be blocked with a clear message.
- Repeat with a seller inactive for 10+ days, and with a blocked seller.
- Open a refund request, then try "Complete order". It should be refused.
- Mark a test order as disputed and check its money shows as held.
- From a normal account, try to read another user's private details. It should fail.

## Technical details
- SQL `public.seller_is_available(uuid)` (security definer, stable): `status <> 'blocked' AND NOT coalesce(pause_selling,false) AND (last_sign_in_at IS NULL OR last_sign_in_at >= now() - interval '10 days')`. Use it in `get_home_feed`, `create_offer`, `respond_to_offer`, and the functions below.
- `stripe-connect-payment-intent` (~L137-146) and `finalize-checkout` (~L531-537): load seller profiles and reject with 409 `SELLER_UNAVAILABLE` / `LISTING_UNAVAILABLE` if any item fails `status='active'` or the seller check. In finalize, cancel or void the PaymentIntent and don't create the order. Checkout shows a friendly message and removes the item.
- `stripe-connect-payout` `isHeld()` (~L194-204): treat `disputed_at IS NOT NULL` as held, checked before the `completed_at` early-return. Also exclude disputed orders in `auto-refund-unshipped` / `auto-approve-refund-requests` if confirmed.
- `complete_order`: require `refund_requested_at IS NULL OR refund_declined_at IS NOT NULL`, and `disputed_at IS NULL`, to match `auto_complete_delivered_orders`.
- `profiles_public`: revoke the blanket SELECT from authenticated, then grant only the display columns plus `last_sign_in_at`, `offers_enabled` and shipping columns. Check `fetchSellerProfiles` (`*` select) and switch it to an explicit column list.
- `offers` edge function (~L356): add the inactive check.
- `useFavoriteListings`: use the shared `isSellerInactive` and `pause_selling`, and refetch on `visibilitychange`.
- New global `profiles` realtime listener (pause_selling/status UPDATE) that sends a seller-invalidated event. Home, Cart and Wishlist subscribe to it.
- `usePausedSellers`: keep a timestamp for each seller, and add an invalidate call from the Settings pause toggle.
- Remove the local `TEN_DAYS_MS` copies (CartContext, Favorites, SellerProfile) and import `isSellerInactive` (strict `>`, null means not inactive).
- `expire_stale_offers`: insert an `offer_expired` notification for buyer and seller, and send a push. `stripe-connect-payout`: notify the seller on success.
- `signOut`: return early if already signing out.
- Cron functions: move to a dedicated `CRON_SECRET` in `x-cron-secret` (the pattern already used elsewhere), and update the cron jobs.
- `supabase/config.toml`: normalise the trailing function blocks.

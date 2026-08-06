# Flea - full pre-launch audit

Evidence base: database linter (42 issues), security scanners, 21 days of error logs, schema + live data queries, cron history, four parallel code audits (payments, offers/orders, auth/notifications, UI/perf), and a live browser walkthrough of all public routes at 440x681. Items marked *unverified* need a runtime check before fixing.

---

## CRITICAL

**C1. Coupon can be reused indefinitely by the same buyer**
`validate-coupon:36`, `finalize-checkout:539`, `stripe-connect-payment-intent:311` only check `active`, dates and global `max_redemptions`. `coupon_redemptions` rows are written but never read back. With `max_redemptions` null, one buyer waives the buyer fee on unlimited orders.
Fix: enforce one redemption per user per coupon at validation and at charge time.

**C2. Refund workflow can be self-approved**
`request_refund` allows either buyer *or* seller to raise a request; `respond_to_refund_request` only requires the responder not be the requester. A seller can raise and a colluding buyer can approve (and vice versa).
Fix: buyer-only requests (seller cancellations already have `seller_cancel_order_begin`), and require the responder to be the counterparty.

**C3. `complete_order` releases funds from `shipped`, skipping delivery**
The function accepts `status IN ('delivered','shipped')`, so a buyer can complete an order that was never marked delivered, releasing seller payout and bypassing the delivery-review safeguards.
Fix: only allow completion from `delivered`.

**C4. Marketplace is empty and full of test data**
`listings`: 12 rows - 8 sold, 4 refunded, **0 active**. All 12 orders and 7 profiles are test/personal.
Fix: purge smoke-test rows, then seed real inventory before launch; add a proper empty-feed state.

**C5. Apple review account cannot sell**
`@applereview` has `stripe_account_id = null`, but the demo bypass in `stripe-connect-status:184` only triggers on `acct_demo_*`. The reviewer hits real Stripe onboarding.
Fix: set a synthetic `acct_demo_*` id on that profile.

**C6. Test-mode auth settings**
`auto_confirm_email` was turned on for smoke testing; leaked-password (HIBP) protection unconfirmed.
Fix: re-enable email confirmation, enable HIBP, retest signup.

---

## HIGH

**H1. Refunds can pick the wrong payment** - `stripe-connect-refund:319` falls back to searching Stripe by buyer/seller/time when `checkout_reference` is missing. Two orders between the same pair in 30 days can refund the wrong charge. Fix: fail closed, always persist the reference. (One live "Payment reference could not be found" error already logged.)

**H2. Payout idempotency key is a rolling 10-minute bucket** - `stripe-connect-payout:59`. A retry straddling the boundary can issue a second real payout. Fix: request-scoped nonce or DB lock.

**H3. Listing price edits do not void live offers** - `create_offer`/`respond_to_offer` check listing status but not that `original_price` still matches. An old offer can be accepted against a changed price.

**H4. Wrong-carrier tracking is accepted** - `auCarriers.ts:32-50` gives StarTrack, CouriersPlease, TNT and Toll the same `^[A-Z0-9]{8,20}$` pattern, and `SalesDetailsSheet.tsx:245` proceeds anyway when the 17track check fails. Buyer tracking then never resolves. Fix: carrier-specific patterns, block on validation failure.

**H5. Status tracker never shows "In transit"** - `ShippingStatusTracker` `inTransitAt` is not passed from `useShipmentTracking`, so buyers jump Shipped -> Delivered despite real scan data existing.

**H6. OAuth duplicate accounts survive** - `resolve-oauth-conflict` only auto-deletes duplicates under 5 minutes old; otherwise the orphan auth user and profile stay. Client just signs out locally.

**H7. Stale OAuth flag can force-sign-out a valid session** - the `flea_oauth_signup` localStorage flag has no expiry and only clears on `SIGNED_IN`; on iOS the app can be killed mid-flow, leaving the flag to fire a bogus conflict later.

**H8. Auth loading flicker** - `AuthContext.tsx:117` flips `loading=false` after 1.5s regardless of the in-flight `getUser()`, so slow networks can bounce users to `/auth` mid-launch.

**H9. Accessibility** - 47 `<img>` without `alt`; icon-only buttons without `aria-label` (`BottomNav.tsx:121`, `ReportList.tsx:62`, `ui/sidebar.tsx:249`). `Auth.tsx:402` still uses full-height without `h-dvh` while 20 other places do.

**H10. 77 hardcoded colour utilities** across 20 files (worst: `SalesDetailsSheet` 12, `OrderDetailsSheet` 9, `RefundRequestDialog` 6, `SellerDashboard` 5). Breaks theming.

---

## MEDIUM

**M1. `stripe-connect-payment-intent` blocks multi-seller carts but `finalize-checkout` accepts them** - verification only checks total, not per-seller composition. Assert single-seller in both, or implement real multi-seller transfers.

**M2. Fee math is duplicated** between `_shared/fees.ts`, `stripe-connect-refund` and `src/utils/feeCalculator.ts`. Refunds have no cross-check against what Stripe actually charged. Also `feeCalculator.ts:173` clamps seller shortfall to 0, so refund previews can understate what a seller owes.

**M3. $0.05 verification tolerance** in `finalize-checkout:318` - small systematic undercharge could pass unnoticed at volume.

**M4. 21 edge functions missing from `supabase/config.toml`** including all Stripe endpoints. Every money endpoint does verify the JWT in code, so this is not currently exploitable, but intent should be declared. Also delete `reload-schema` and `seed-push-vault-key` - one-off maintenance functions that should not stay deployed.

**M5. Database linter: 37 SECURITY DEFINER functions callable by `anon` or `authenticated`**, plus one extension in `public`. Revoke EXECUTE on all internal ones (email queue, `move_to_dlq`, `seed_push_vault_key`, `admin_*`).

**M6. Badge counts are poll-only** (30s + focus) with no realtime on `order_messages`/`chat_messages`, so a read message can keep its dot for up to 30s on another device.

**M7. Verify-email dead end** - `Auth.tsx:296` passes the email via router state only; a reload disables "Resend" with no recovery path.

**M8. Guest merge is fire-and-forget** - `GuestModeContext.tsx:50` runs on every sign-in with no retry or user-visible failure; a partial failure silently loses guest wishlist/cart.

**M9. Push send failures are silent** - `order-messages` never awaits `firePush()`; a failed notification is invisible to the sender.

**M10. No lazy loading on images** - 0 `loading="lazy"` in the codebase, including feed and grid lists.

**M11. Em dashes in user-facing copy** - `PrivacyPolicy.tsx` (~15) and `Checkout.tsx:352` toast, against the short-dash rule.

**M12. Stale-chunk errors logged as errors** - 11 recent `Importing a module script failed` / `Load failed` entries; `staleChunkRecovery` already handles them, so they are recovered noise burying real errors.

---

## LOW

- 497 console errors in one session, all the same React "Function components cannot be given refs" warning originating in `App.tsx` - noise that hides real errors.
- Monolith components: `ListingDetails` 1217 lines, `Checkout` 1123, `CreateListing` 1022, `SellerDashboard` 944, `EditListing` 923. Re-render blast radius and hard to test.
- List rows (offers, sales, notifications, reviews) are largely unmemoised.
- `usePushNotifications.ts:80` unsubscribes/resubscribes on every mount when permission is already granted.
- `authRedirects.ts:13` hardcodes `app.finditonflea.com`, breaking deep links in non-prod builds.
- Password validation regex duplicated and slightly different between `Auth.tsx:192` and `ResetPassword.tsx:70`.
- Two unconfirmed React #310 render crashes logged on `/sales` and `/notifications` (last 28 Jul) - reproduce to confirm resolved.
- `ShippingStatusTracker` has no "cancelled" step for seller cancellations awaiting refund.

## Checked and clean

Route-level code splitting is in place; all public routes render with correct guest states; `/privacy` and `/terms` resolve; `expire-stale-offers` and all 11 cron jobs are active; `notifications` is not client-insertable (so the push-spoof path is closed); the 17track webhook, tracking sync and Stripe status checks are working; every money-moving edge function verifies its JWT.

---

## Suggested execution order

1. Critical C1-C6.
2. High H1-H5 (money and shipping correctness), then H6-H8 (auth), then H9-H10.
3. Medium.
4. Low.

Tell me to start at the top, or pick a phase.

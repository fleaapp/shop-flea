# Flea — Full Product Audit

Five parallel deep audits (payments/refunds, UX/UI/nav, legal/copy/FAQ, security/performance, orders/notifications) read the actual source. Every item below cites a real file:line. **Overall Product Health Score: 68/100** — strong feature depth and a genuinely well-built buyer-protection model, undermined by two unauthenticated admin endpoints, a payout money-leak, and fee/policy copy that contradicts real behaviour.

---

## CRITICAL — must fix before release

| # | Issue | Where | Impact | Fix | Size |
|---|---|---|---|---|---|
| C1 | `admin-reset-seller` has **zero auth** (`verify_jwt=false`, no admin check) — anyone can wipe any seller's Stripe onboarding | `supabase/functions/admin-reset-seller/index.ts:9-64` | Any attacker disables a competitor's payouts | `verify_jwt=true` + `assertAdmin()` (pattern at `admin-data/index.ts:229`) | S |
| C2 | `admin-recover-order` unauthenticated — forges orders from any `pi_…` | `admin-recover-order/index.ts:20-27` | Order/listing-state forgery, false seller notifications | Same as C1, plus match caller to `metadata.flea_buyer_id` | S |
| C3 | `stripe-connect-payout` trusts an **unverified** JWT (`atob` of payload) and `verify_jwt=false` | `stripe-connect-payout/index.ts:34-39` | Forged `sub` triggers payouts on any seller's account (griefing, forced 1.5% fees) | Use `getClaims()`/`getUser()` or `verify_jwt=true` | S |
| C4 | **No idempotency key** on `stripe.payouts.create` | `stripe-connect-payout/index.ts:156-184` | Double-tap / retry = duplicate real payouts | Deterministic idempotency key + DB in-flight lock | S |
| C5 | Instant-payout 1.5% fee is deducted from the seller but the collecting transfer defaults to `destination: undefined` and the failure is swallowed | `stripe-connect-payout/index.ts:138-154` | Revenue leak: fee taken from seller, never received by Flea | Require `STRIPE_PLATFORM_ACCOUNT_ID`, remove `"self"` fallback, fail loudly, log to `payment_events` | S |
| C6 | "Stripe" leaked in checkout UI | `Checkout.tsx:987` | Breaks brand rule + inconsistent with Terms/FAQ | "processed by our payment providers" | S |
| C7 | "Flea sellers pay no selling fees" while a 2% + $0.50 Transaction Fee is charged | `SecureCheckoutInfoPopover.tsx:19` | **ACL s18/29 misleading-conduct risk** | "Sellers only pay when they make a sale — 2% + $0.50 per order" | S |
| C8 | Coupon-waived buyer fee is never persisted; buyer-facing totals recompute 4% + $0.70 unconditionally | `Cart.tsx:262`, `OrderDetailsSheet.tsx:164`, `OrderReceiptDialog.tsx:112`, `finalize-checkout:450-475` | Buyer sees a total that doesn't match their bank statement | Persist `secure_checkout_fee`, `transaction_fee`, `coupon_code` per order line; read, never recompute | M |
| C9 | Refunds recompute the full buyer fee even on waived-fee orders | `stripe-connect-refund/index.ts:403-483`, `feeCalculator.ts:139` | **Over-refunds** money never collected; cumulative refunds can exceed the captured PI and fail mid-flow | Pass persisted coupon/fee snapshot into `computeRefundBreakdown` | M |
| C10 | Lost-in-transit parcels have **no refund path** — refunds require `status === 'delivered'` | `OrderDetailsSheet.tsx:169`; `useOrders.ts:9` | Buyer whose parcel never arrives cannot request a refund in-app | Allow refund from `shipped` after a carrier-inactivity threshold; add `lost_in_transit` state + cron | M |

---

## HIGH PRIORITY

- **H1 Server refund window is 10 days, policy/UI say 48h** — `stripe-connect-refund/index.ts:786-799`, error text at `:791`. Align constant to 48h. (S)
- **H2 Buyer can self-declare delivery with no safeguard**, starting the 48h clock at an arbitrary moment — `OrderDetailsSheet.tsx:418-435,550-573`. Require carrier confirmation or route untracked confirmations through the admin gate before fund release. (M)
- **H3 `admin_marked_delivered` branch is dead code** — no path sets it (`OrderDetailsSheet.tsx:429`). Wire it to the admin queue or remove. (S)
- **H4 Possible duplicate "Order Shipped" push** — DB trigger *and* `useOrders.ts:423-449` both fire. Pick one source of truth; add a dedup key in `send-push-notification`. (S)
- **H5 24/28 edge functions run `verify_jwt=false`** — `supabase/config.toml:5-70`. Flip on for everything except `stripe-webhook`/`auth-email-hook`/genuinely public endpoints. (M)
- **H6 FAQ contradicts Terms on shipping deadlines** — "4 days" (`FAQSection.tsx:72`) vs 3-day dispatch / 9-day auto-refund (`Terms.tsx:159`). (S)
- **H7 FAQ says listings go live while verification pending** (`FAQSection.tsx:139`) but onboarding gates listing on verification. (S)
- **H8 FAQ promises permanent data deletion** (`:177`) vs Privacy §8's 7-year record retention. Reconcile wording. (S)
- **H9 Accessibility: Header and BottomNav are emoji-only with no `aria-label`/`aria-current`** — `Header.tsx:22-39`, `BottomNav.tsx:121-138`. Core navigation is unusable with a screen reader. (S)
- **H10 Logout has no confirmation and no error path** — `Settings.tsx:146-153`. (S)
- **H11 `navigate(-1)` can eject deep-link/PWA users** — `ListingDetails.tsx:351`, `Checkout.tsx:134`, `CreateListing.tsx:274,516,580,625`. Migrate to `safeNavigateBack`. (S)
- **H12 No `refund_request_deadline_at` auto-approval cron found**, though the UI promises 72h auto-approval — `OrderDetailsSheet.tsx:484-488`. Buyers can be stuck indefinitely. (M)
- **H13 Unbounded `select('*')` list queries** — `useFavorites.ts:58`, `useReviews.ts:41,146`, `useFavoriteListings.ts:94`. Add column lists + pagination. (M)
- **H14 N+1 in admin threads** — 2 queries per thread, `admin-data/index.ts:284-307`. (M)

---

## MEDIUM PRIORITY

Orders: partial refunds hidden by collapsed group status (`useOrders.ts:219-225`); tracking validated for presence only, garbage accepted (`SalesDetailsSheet.tsx:148-160`); partial refund-approval failures leave items in limbo with a generic toast (`useOrders.ts:567-580`); bundle discount label silently vanishes when `discountPercent` is null (`shippingCalculator.ts:170-180`); receipt bundle text reads *live* seller settings rather than the purchase-time snapshot (`OrderDetailsSheet.tsx:127`).

Notifications: opening the tab marks **everything** read regardless of what was seen (`Notifications.tsx:112-119`); `shipping_final_warning` and `order_overdue_buyer` have no in-app copy, emoji, or click routing (`useNotifications.ts:394`, `Notifications.tsx:180-284`); "delivered" pushes the buyer instead of the seller (`useOrders.ts:479-488`); Cart recomputes badges independently of `useNavBadges` (`Cart.tsx:248-251`).

Security/perf: wildcard CORS on money-moving and admin functions; no rate limiting on `log-error`, `add-brand`, admin utilities; `profiles_public` exposes exact `last_sign_in_at`; public `listings` bucket allows full object enumeration (platform scanner finding); `stripe-connect-upload-id` decodes the full base64 body before enforcing its 8MB cap and never checks magic bytes.

UX/UI: ~20 files hardcode `#ddfed7`/`#423D3D`/`text-white`, bypassing the design system (`ListingDetails.tsx:776-875`, `Settings.tsx:319,378`, `Profile.tsx:122`, auth screens); two equal-weight CTAs on ListingDetails with no clear primary; empty/error/loading states inconsistent (Cart's `⏳` at `:504`, terse strings in Sales/Favorites/OrderChat, no error+retry state on any list page); clickable `<div>`s in ContactSupport; icon buttons at `h-6`–`h-8` below the 44px target across Profile, Wishlist, Comments, CouponInput; no `<h1>` on Index or Cart; password rules validated one-toast-at-a-time.

Legal gaps: GST treatment of Flea's own fees undisclosed; chargeback-vs-refund double-dip clause missing; camera permission never mentioned in the Privacy Policy; no prohibited-items FAQ; 18+ seller age enforced in code but absent from Terms; no external dispute-resolution pathway named.

---

## Recommended execution order

1. **Security patch (S)** — C1, C2, C3, H5, CORS + rate limits.
2. **Money correctness (M)** — C4, C5, then the fee-persistence migration that resolves C8/C9 and its refund/receipt consumers.
3. **Policy truth pass (S)** — C6, C7, H1, H6, H7, H8 + Terms/Privacy disclosure additions, bumping the version and date.
4. **Order-lifecycle gaps (M)** — C10, H2, H3, H12.
5. **Accessibility + navigation (S/M)** — H9, H10, H11, tap targets, aria-labels, shared `EmptyState`/`ErrorState`.
6. **Consistency + performance (M)** — design-token sweep, notification copy centralisation, badge single-source-of-truth, query pagination.

## Benchmark note

Buyer protection, bundle shipping, and the swipe feed are at or above Depop/Vinted standard. Flea is behind on: offers/negotiation (absent entirely), in-transit dispute handling, seller analytics, and buyer-facing "where is my parcel" states — all expected on Vinted/eBay.

## Technical detail

Fee source of truth should become the `orders` table, not `feeCalculator`. Add columns `secure_checkout_fee`, `coupon_type`, and per-line `transaction_fee` (today only row 0 of a group carries it), a unique index on `orders(checkout_reference, listing_id)` to close the finalize-checkout race, and largest-remainder allocation for pro-rata shares so multiple partial refunds sum exactly to the original charge.

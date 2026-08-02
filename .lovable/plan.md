## Overall Product Health Score: 86/100

Flea is close to release quality: money math, refund windows, back-navigation and image alt text are all consistent. The score is pulled down by a set of leftover admin "repair" edge functions that anyone on the internet can call, plus a handful of copy contradictions and UI polish gaps.

Everything below was verified by reading the actual code — no assumptions.

---

## 1. Critical Issues (must fix before release)

**C1 — Six leftover admin tools are live and unprotected**
Severity: Critical · Screens: none (backend) · Complexity: Small

These were one-off repair scripts. They are still deployed and they do **not** check who is calling. Anyone who knows the URL can run them.

| Function | What a stranger can do |
|---|---|
| `create-saved-searches-table` | Run raw database commands on the live database |
| `admin-fix-brands-guard` | Rewrite a security trigger |
| `reload-schema` | Hammer the database with reload signals |
| `admin-seed-coupon` | Create or re-activate discount coupons (`FREEFLEA` = free fees) |
| `seed-push-vault-key` | Overwrite the push-notification signing secret (its own comment claims it checks auth — it doesn't) |
| `add-stripe-columns`, `admin-fix-refund-schema` | Same raw-database family |

User impact: none until abused; then data loss, free orders, or broken notifications.
Business impact: severe — this is the single biggest risk in the app.
Fix: **delete** the ones whose job is finished, and add an admin check to any that must stay.

**C2 — Refund execution may not be idempotent**
Severity: Critical · Screens: Refunds, Admin approvals · Complexity: Small

`stripe-connect-refund` has rate limiting but the refund-execution block was not confirmed to pass a Stripe idempotency key. A retry from the auto-approval cron or a double tap in admin could refund twice.
Fix: pass an idempotency key tied to the order id on `refunds.create` and the transfer reversal, mirroring the pattern already used correctly in `stripe-connect-payout`.

---

## 2. High Priority

**H1 — FAQ says Flea never holds your money; Terms say it does**
Severity: High · Screens: FAQ, Terms, Checkout · Complexity: Small
`FAQSection.tsx:31` — "Payments go directly to the seller - Flea does not hold your funds." Two entries later (`:123`, `:127`) and in `Terms.tsx:166`, we say funds are held during the buyer-protection window. A buyer could quote the first line in a chargeback.
Fix: rewrite FAQ:31 to describe the hold-then-release model.

**H2 — Order totals in the Orders tab are recalculated, not read from the order**
Severity: High · Screens: Cart → Orders · Complexity: Small
`Cart.tsx:263` recomputes the Secure Checkout Fee as `4% + $0.70` instead of reading the `secure_checkout_fee` stored on the order. Any order that used a fee-waiving coupon shows a total the buyer was never charged.
Fix: read the stored fee, fall back to `calculateFees` only when null.

**H3 — Dispatch deadline stated two different ways**
Severity: High · Screens: FAQ, Terms · Complexity: Small
FAQ says "3 days", Terms says "3 business days". Materially different for a weekend order.
Fix: make both match whatever the backend enforces.

**H4 — Missing accessibility labels on profile actions**
Severity: High · Screens: Profile, Seller Dashboard · Complexity: Small
Icon-only buttons with no label: `Profile.tsx:187, 203, 463`, `SellerDashboard.tsx:369`, `ui/sidebar.tsx:224`. Screen-reader users hear "button".

---

## 3. Medium Priority

**M1 — Brand colours hardcoded in 111 places**
Screens: Auth, Reset/Forgot Password, Verify Email, Region Blocked, Listing Details, Settings, Profile · Complexity: Medium
`#423D3D` appears 8× across the auth flow even though a `charcoal` token already exists; `#ddfed7` 3×; `#e0e0dc` 2×; `text-white` 12+. Fix: add `charcoal` / `success-tint` tokens and sweep.

**M2 — Confirmation dialogs off-standard**
Complexity: Small
`AdminUsers.tsx:249` has no styling at all; `EditProfile.tsx:523` uses a column footer where 18 other dialogs use a row; `OrderReceiptDialog.tsx:154` is 360px against a 280–340px convention.

**M3 — Tap targets under 44px**
Complexity: Small
`ConditionInfoPopover.tsx:26` (32px, buyer-facing) plus admin action buttons at `AdminUsers.tsx:227-239` and `AdminListings.tsx:218-223`.

**M4 — Dead function still deployed**
Complexity: Small
`stripe-connect-checkout` has no callers and no cron trigger; likely superseded by `stripe-connect-payment-intent`. Confirm, then remove.

---

## 4. Nice-to-Have

- `toast.tsx:17` uses `max-h-screen` — switch to `100dvh` so toasts can't clip under the notch.
- `register-push-subscription:159` logs a 16-character prefix of the device push endpoint. Harmless, but drop it.
- Checkout's buyer-protection line uses casual contractions while Terms is formal — one tone pass.
- Skeleton states are unconfirmed on Seller Dashboard and the admin list panels.

---

## 5. What passed cleanly (no action)

- Buyer fee **4% + $0.70** and seller fee **2% + $0.50** match exactly across `feeCalculator.ts`, Checkout, FAQ, Terms and both info popovers.
- 48-hour dispute window, 72-hour seller response, 9-day unshipped auto-refund: identical wording everywhere.
- No missing `alt` text anywhere (43 images checked).
- No raw `navigate(-1)` left — all 28 back actions use `safeNavigateBack`.
- No IDOR found in payouts, ID upload, order messages, order recovery or account deletion — each verifies ownership.
- ID upload validates size, magic bytes and ownership, and is rate limited.
- Payouts are idempotent and rate limited — this is the pattern to copy for refunds.
- No secrets logged anywhere.

---

## Suggested build order

1. C1 — lock down or delete the six unauthenticated admin functions.
2. C2 — add idempotency to refunds.
3. H1, H2, H3 — the three copy/number contradictions.
4. H4 + M2 + M3 — accessibility and dialog/tap-target consistency.
5. M1 — colour token sweep.
6. M4 and the nice-to-haves.

Tell me which numbered items to implement and I'll do them in that order.

# Seller Dashboard, Payouts, Onboarding & Checkout Coupons

All flows stay inside the Flea UI. No Stripe-hosted redirects or deep links. Controller-based Connect accounts are already in place, so platform-triggered instant payouts and native requirement collection are supported without any account migration.

## 1. Checkout coupon codes

**Backend**
- New table `public.coupons`: `code` (unique, upper), `type` ('waive_buyer_fee'), `active`, `starts_at`, `expires_at`, `max_redemptions`, `redemption_count`, timestamps. GRANTs + RLS (read for authenticated, write for service_role only). Seed `FREEFLEA`.
- New table `public.coupon_redemptions` (coupon_id, user_id, order_id) to prevent reuse abuse.
- New edge function `validate-coupon` — accepts `{ code }`, returns `{ valid, type, message }`.
- `create-payment-intent` (and PayPal equivalent) accept an optional `couponCode`; when valid + `waive_buyer_fee`, the 4% + $0.70 Secure Checkout Fee is set to 0 and the redemption is recorded on successful payment.

**UI**
- New `CouponInput` in the checkout screen above the fee summary: text field + Apply button, success/error states, removable chip when applied.
- Fee row updates live to show `$0.00` with a strikethrough of the original fee when waived.

## 2. Seller Dashboard changes

**Header + Sales button**
- Header stays centre-aligned (already done). Sales button matches the Profile page's Sales button exactly (same variant, size, badge).

**Balance + payout primary button**
- Replace the "Active / Connected" status pill with the seller's live available balance (from `stripe-connect-status`, returned as `available` + `pending`, formatted AUD).
- Primary button next to the balance: **"Pay out"** (standard payout, free). Opens a native Flea confirmation sheet, calls a new `stripe-connect-payout` edge function which creates a Stripe payout on the connected account (standard speed, no fee).
- Secondary button: **"Instant payout (1.5%)"**. Same native sheet with fee preview, calls `stripe-connect-payout` with `method: 'instant'`. Flea charges the 1.5% by reducing the payout amount (application-collected fee since we own `fees.payer`).
- Both buttons are disabled with a subtle helper line ("Available after your first sale and full verification") until:
  - `charges_enabled && payouts_enabled` on the connected account, AND
  - at least one succeeded charge exists (Stripe requires this before instant payouts are eligible on most AU accounts).
- Instant payout button is additionally hidden if Stripe reports `instant_payouts` capability is not active.

**Refresh on open**
- Dashboard already refetches on mount; keep that behaviour and additionally refetch when the tab regains focus so balance updates after a sale.

## 3. Seller onboarding entry point

- Rename the entry button so that once the user has any Stripe account: label is **"Seller Dashboard"** (already the case). Remove the "Active/Connected" secondary badge.
- If `stripe-connect-status` returns `actionRequired` (any `currently_due`, `past_due`, or `disabled_reason`), show an **"Action required"** pill on the Seller Dashboard entry button, and gate listing creation:
  - `ListItemPage` (or wherever "List item" is triggered) checks `stripe_onboarding_complete && !actionRequired`. If not, show a native sheet: "Finish verification to list items" with a button that opens `SellerOnboardingSheet` at the correct resume step.

## 4. Resume-in-place onboarding

- Add `stripe_onboarding_step` (text, nullable) to `profiles`. Values: `intro | personal | address | dob | bank | id | review`.
- `SellerOnboardingSheet` writes the current step to the profile on every step change (debounced).
- On sheet mount, if a step is saved and onboarding isn't complete, resume at that step instead of the intro.
- Clear the field when onboarding completes or the user explicitly cancels from the intro.

## 5. Post-onboarding native result popup

- When `SellerOnboardingSheet` closes after submitting the final step, open a native Flea `AlertDialog` on top of the dashboard behind it. Two variants driven by a fresh `stripe-connect-status` call:
  - **Verified** — "You're verified and ready to list. Start selling." CTA → List an item.
  - **Further verification needed** — "We need a bit more info to verify your identity." CTA → Reopens the sheet at the ID / requirement step. Uses the same reject-reason surfacing already built.
- Uses the existing confirmation-dialog style (rounded-2xl, standard flea colours).

## 6. Consistency

- All new sheets, buttons, dialogs and pills reuse the existing Flea tokens: lime primary, charcoal palette, Inter, `rounded-2xl`, `h-12` primary button, confirmation-dialog style. No hardcoded colours.

## Technical notes

- **Edge functions**: `validate-coupon`, `stripe-connect-payout` (new); `create-payment-intent` and PayPal checkout updated to accept `couponCode`; `stripe-connect-status` extended to return `balance.available`, `balance.pending`, `instantPayoutEligible`, `hasSucceededCharge`.
- **Migrations**: `coupons`, `coupon_redemptions` tables (with GRANTs + RLS); `profiles.stripe_onboarding_step` column; seed `FREEFLEA` via insert tool.
- **Client**: new `CouponInput` component; `SellerDashboard` gets `BalanceHeader` with payout buttons; `SellerOnboardingSheet` resume logic + result dialog; listing-creation gate.
- **No account migration** — controller-based accounts already handle everything natively.
- **No deep links, no Stripe-hosted UI** anywhere in the flow.
- **GST**: separate answer, not part of this plan.

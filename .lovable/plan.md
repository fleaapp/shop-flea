
# Consolidated Stripe Overhaul Plan

Everything we've discussed, reconciled and deduped.

## Decisions locked in

1. **Fee model** — no percentage platform fee. Flea revenue = **Secure Checkout Fee (4% + $0.70)** paid by the buyer. `PLATFORM_FEE_RATE = 0`. Routed to Flea via `application_fee_amount` on the PaymentIntent. Update `mem://infrastructure/payment-model-and-fees` (currently says 7%).
2. **Connect account type** — migrate to **Stripe Express**.
3. **Seller dashboard** — build embedded, Depop-style. No Stripe branding, no external redirect. Includes read-only balance, payments and payouts history.
4. **Payouts** — **manual instant payout button**, gated on verification. Seller taps to withdraw. Stripe's 1.5% instant payout fee is absorbed by the seller (Flea adds nothing on top). Default cadence stays `manual` — nothing moves automatically.
5. **Existing sellers** — none in production except you; **hard reset** the `stripe_account_id` / `stripe_onboarding_complete` columns and re-onboard through the new flow. No migration notification.
6. **Design** — keep current `SellerOnboardingSheet` shell (address autocomplete, `z-[100]` state dropdown, `max-w-[310px]` disclaimer, lime CTA, Inter). Body swaps to embedded Stripe components with Flea appearance tokens.

## Architecture

### Connect account (Express, application-controlled)

`stripe.accounts.create`:
```ts
controller: {
  stripe_dashboard: { type: "none" },
  fees: { payer: "application" },
  losses: { payments: "application" },
  requirement_collection: "application",
},
capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
country: "AU",
default_currency: "aud",
settings: { payouts: { schedule: { interval: "manual" } } },
```

`stripe_dashboard.type = "none"` means no Stripe-hosted login — sellers only ever see Flea's embedded UI.

### Embedded Connect surfaces

New `stripe-connect-account-session` edge function mints an `AccountSession` client secret enabling:
- `account_onboarding`
- `account_management`
- `payments`
- `payouts` with `features.instant_payouts: true`
- `balances`
- `notification_banner`

Frontend uses `@stripe/react-connect-js` + `@stripe/connect-js` with Flea appearance (lime primary, charcoal, Inter).

### Seller Dashboard route `/seller-dashboard`

Tabs (all embedded, styled inside Flea chrome):
| Tab | Component | Notes |
|---|---|---|
| Payouts | `<ConnectPayouts />` | Includes Stripe's native instant payout CTA — this is our button. |
| Balance | `<ConnectBalances />` | Available + pending. |
| Payments | `<ConnectPayments />` | Per-order detail, refunds visible. |

Plus `<ConnectAccountManagement />` behind an "Update payout details" link (bank/card, personal info). `<ConnectNotificationBanner />` mounted at the top of the dashboard for any Stripe-side "action required" prompts.

### Manual instant payout

Sellers tap the instant payout CTA inside `<ConnectPayouts />` (Stripe renders it because we enabled `features.instant_payouts`). We do **not** build a custom button — Stripe's own embedded UI shows balance, arrival time and 1.5% fee, then calls `stripe.payouts.create({ method: "instant" })` on the connected account. No auto-flush cron, no custom edge function for payouts.

Gating: button only appears when `charges_enabled && payouts_enabled` and an instant-eligible debit card is on file. The embedded component handles all of that logic itself.

### Onboarding

- Replace `SellerOnboardingSheet` body with `<ConnectAccountOnboarding />`.
- Keep the shell exactly as-is (drawer style per `mem://style/layout/drawer-style`, address autocomplete unchanged, footer copy).
- Stripe collects everything: identity, business type, external account (debit card for instant payouts).
- On completion, we call `stripe-connect-status` to confirm and set `stripe_onboarding_complete = true`.

### Hard reset SQL

```sql
update public.profiles
set stripe_account_id = null,
    stripe_onboarding_complete = false
where stripe_account_id is not null;
```

### Fee flow (unchanged from current checkout, documented here)

```
buyer pays: subtotal + shipping + secureCheckoutFee (4% × subtotal + $0.70)
PaymentIntent:
  amount = subtotal + shipping + secureCheckoutFee
  application_fee_amount = secureCheckoutFee     ← Flea revenue
  on_behalf_of / transfer_data.destination = seller_acct
  metadata.order_ids = [...]
seller balance receives: subtotal + shipping − Stripe processing fees
seller taps Instant Payout → 1.5% Stripe fee deducted from payout amount
```

## Files

### New
- `supabase/functions/stripe-connect-account-session/index.ts` — mints AccountSession per authenticated user.
- `src/lib/stripe/connect.ts` — singleton `loadConnectAndInitialize` with Flea appearance tokens.
- `src/components/stripe/FleaConnectProvider.tsx` — wraps children in `<ConnectComponentsProvider>`.
- `src/components/stripe/EmbeddedOnboarding.tsx`
- `src/components/stripe/EmbeddedPayouts.tsx`
- `src/components/stripe/EmbeddedBalances.tsx`
- `src/components/stripe/EmbeddedPayments.tsx`
- `src/components/stripe/EmbeddedAccountManagement.tsx`
- `src/pages/SellerDashboard.tsx` — tabs shell.

### Modified
- `supabase/functions/stripe-connect-onboard/index.ts` — Express + application controller, `payouts.schedule.interval = "manual"`, returns only `{ accountId }` (no hosted onboarding link).
- `supabase/functions/stripe-connect-status/index.ts` — read `charges_enabled` / `payouts_enabled` / `requirements` from the new account shape.
- `supabase/functions/stripe-webhook/index.ts` — handle `account.updated` to flip `stripe_onboarding_complete`, and `payout.paid` / `payout.failed` for notifications.
- `supabase/config.toml` — register `stripe-connect-account-session` with `verify_jwt = false`.
- `src/components/SellerOnboardingSheet.tsx` — swap body for `<EmbeddedOnboarding />`; keep shell, address autocomplete, `z-[100]` state dropdown, `max-w-[310px]` disclaimer, lime CTA.
- `src/pages/Settings.tsx` — "Seller Dashboard" navigates to `/seller-dashboard` (in-app), remove `openInAppUrl('https://dashboard.stripe.com')`.
- `src/components/PaymentMethodsSection.tsx` — Seller Dashboard row → in-app route; keep existing status pills (✅ Connected / 🔍 Pending review / ⚠️ Action required).
- `src/components/SalesDetailsSheet.tsx` — remove custom "Instant Payout" button (Stripe's embedded UI provides it inside the dashboard); keep sale detail layout per `mem://style/layout/sale-details-payout-ui`.
- `src/utils/feeCalculator.ts` — confirm `PLATFORM_FEE_RATE = 0`; Secure Checkout Fee `4% + $0.70` unchanged.
- `src/components/FAQSection.tsx` — update fee wording to match (no 7%, mention 1.5% instant payout fee absorbed by seller).
- `src/App.tsx` — add `/seller-dashboard` route inside `ProtectedRoute`.
- `App.tsx` deep-link handler — no change needed (already handles auth callback).

### Package installs
- `@stripe/connect-js`
- `@stripe/react-connect-js`

### Memory updates after ship
- `mem://infrastructure/payment-model-and-fees` — 4% + $0.70 Secure Checkout Fee, no 7% platform fee, 1.5% instant payout fee absorbed by seller.
- `mem://infrastructure/stripe-connect-standard-config` → rename to `stripe-connect-express-config` and rewrite.
- `mem://features/payment-connection-states` — refer to embedded surfaces, no more external Stripe dashboard.
- `mem://style/layout/settings-page` — remove Stripe references.

## Risks

- **App Store review** — embedded Connect inside Capacitor WebView is standard for marketplace apps; low risk. Ensure no external `dashboard.stripe.com` link remains anywhere user-facing.
- **`losses.payments = "application"`** — Flea is on the hook for disputes and negative balances. Accepted trade-off for the seamless UX you want.
- **Instant payout not eligible** — Stripe's embedded UI handles the not-eligible messaging itself (asks seller to add a debit card). No custom copy needed.

## Rollout — single ship

1. Install packages.
2. Hard-reset migration.
3. Edge functions (`stripe-connect-account-session` new, `stripe-connect-onboard` / `stripe-connect-status` / `stripe-webhook` modified) + `config.toml`.
4. Embedded components + `SellerDashboard` page + route.
5. Swap `SellerOnboardingSheet` body.
6. Update `Settings` + `PaymentMethodsSection` navigation.
7. Remove custom instant-payout button from `SalesDetailsSheet`.
8. FAQ + fee copy fixes.
9. Re-onboard yourself through the new flow to verify end-to-end (charge, balance, instant payout to card).

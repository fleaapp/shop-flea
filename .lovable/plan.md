## Goal
Replace the Stripe-hosted Checkout redirect with an in-app payment sheet. Payment stays inside Flea. Depop-style method picker (Apple Pay / Google Pay / Saved cards / Add new card) with Vinted-style card form. Fees, coupon, shipping, and Connect routing stay identical.

## Architecture

Current flow: `stripe-connect-checkout` edge function creates a Stripe Checkout Session → redirects to hosted page → returns to `/checkout/success`.

New flow:
```text
Checkout.tsx
  ├─ picks method (Apple Pay | Google Pay | Saved card | New card)
  ├─ calls stripe-connect-payment-intent  (new edge fn)
  │    → creates PaymentIntent on Flea platform account
  │    → application_fee_amount = buyer fee (4% + $0.70, waived if FREEFLEA)
  │    → transfer_data[destination] = seller connected acct  (direct charge)
  │    → on_behalf_of = seller
  │    → customer = buyer Stripe customer
  │    → returns { clientSecret, ephemeralKey, customerId, paymentIntentId }
  ├─ Native (Capacitor): @capacitor-community/stripe PaymentSheet.present()
  ├─ Web: @stripe/react-stripe-js <PaymentElement/> in embedded drawer
  └─ On success → POST finalize-checkout with paymentIntentId → orders row created
```

Saved cards: PaymentSheet's built-in `customerEphemeralKeySecret` + `customerId` shows and saves cards automatically. Web Payment Element uses `setup_future_usage: 'off_session'` when "Save card" is ticked.

## New / changed files

**New edge functions**
- `supabase/functions/stripe-connect-payment-intent/index.ts` — creates PI + ephemeral key, computes fees via existing `feeCalculator` port, validates coupon (`FREEFLEA` waives buyer fee), pulls seller `stripe_account_id`, sets `application_fee_amount` and `transfer_data.destination`.
- `supabase/functions/stripe-connect-finalize-intent/index.ts` — verifies PI status = `succeeded`, creates orders rows (mirror current `finalize-checkout` logic keyed off PI instead of session).

**Modified edge functions**
- `supabase/functions/stripe-connect-checkout/index.ts` — keep as fallback / delete once new flow is verified. Leave in place initially.

**New frontend files**
- `src/components/checkout/PaymentMethodPicker.tsx` — Depop-style radio list: Apple Pay (iOS), Google Pay (Android), saved cards, "Add new card". Uses Flea lime/charcoal tokens.
- `src/components/checkout/CardDetailsSheet.tsx` — Vinted-style full-screen drawer with card brand logos (Mastercard/Visa/Amex/eftpos), Cardholder name, Card number (Stripe CardNumberElement), Expiry + CVC row, "Save card" checkbox, sticky "Use this card" button.
- `src/lib/stripe/paymentSheet.ts` — thin wrapper: if `Capacitor.isNativePlatform()` → `@capacitor-community/stripe` PaymentSheet; else → mount `<Elements>` + `<PaymentElement>` with Flea appearance tokens.
- `src/lib/stripe/loadStripe.ts` — cached `loadStripe(publishableKey)`.

**Modified**
- `src/pages/Checkout.tsx` — replace the "Payment" card + redirect button with `<PaymentMethodPicker>` + Pay button that opens the in-app sheet. Keep header, summary, coupon, shipping, fee lines, totals exactly as-is.
- `src/pages/CheckoutSuccess.tsx` — accept `payment_intent` query param path in addition to `session_id`.
- `capacitor.config.ts` — no change (plugin auto-registers).
- `ios/App/App/Info.plist` — add `NSApplePayMerchantID` (documented for user; requires native rebuild — I'll flag this).

**Deps**
- `@stripe/stripe-js`, `@stripe/react-stripe-js` (web)
- `@capacitor-community/stripe` (native)

## Secrets
Uses existing `STRIPE_SECRET_KEY`. Publishable key hardcoded in frontend (public). Apple Pay merchant ID + Google Pay merchant config are Xcode/AndroidManifest changes the user has to do once in Xcode/Android Studio — I'll document exactly what to add.

## Fees (unchanged)
`application_fee_amount` = `Math.round((subtotal * 0.04 + 0.70) * 100)`, set to `0` when coupon = `FREEFLEA`. Rest of the total flows to the seller's connected account via `transfer_data.destination` (direct charge, same as today).

## Out of scope
- Settings > Payments saved-card management screen (Vinted has one). Cards are still saved and re-usable in checkout; managing/deleting them from Settings can be a follow-up.
- Migrating existing `stripe-connect-checkout` callers away — I'll leave it deployed until you confirm the new flow works.

## Testing plan
1. Web: Chrome with 4242 4242 4242 4242 → success → order created.
2. Web: same with FREEFLEA → fee $0.
3. Native iOS build: Apple Pay sheet shows Flea branding, completes, order created.
4. Saved card: second checkout shows previously-saved card at top.

## Heads-up (needs your action after code merges)
- Native rebuild required (`npx cap sync ios && npx cap sync android`).
- Apple Pay: create merchant ID `merchant.app.finditonflea` in Apple Developer, enable Apple Pay capability in Xcode, register domain in Stripe dashboard.
- Google Pay: nothing extra beyond the plugin; works in test mode out of the box.

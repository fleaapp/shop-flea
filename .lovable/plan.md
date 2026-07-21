## Diagnosis

"Card was declined" with no 3DS prompt = the **issuer's bank** rejected the charge before authentication. It is not a bug in your code or your Connect setup — the PaymentIntent, application fee, and `on_behalf_of` routing are all valid (Apple Pay on the same card and same PI proves it).

Apple Pay succeeds where manual card fails on a new merchant because the card is presented as a **tokenized, device-bound credential**. Issuers' fraud models heavily favor these — the same PAN entered manually on a first-time merchant (descriptor "FLEA", AU, cross-border processing) frequently trips a generic `do_not_honor` or `generic_decline`.

### Why we can't tell you exactly which rule fired
Right now `src/pages/Checkout.tsx:521` surfaces only `error.message`, which for issuer declines is always the generic string "Your card was declined." The actual **decline code** (`generic_decline`, `insufficient_funds`, `do_not_honor`, `stolen_card`, `lost_card`, `pickup_card`, etc.) is on `error.decline_code` and `error.code`, and the full `PaymentIntent.last_payment_error` is available on the intent itself.

## Will native Apple Pay work?

Yes — with high confidence. Native uses the same `stripe-connect-payment-intent` and the same live-mode PaymentIntent. If PWA Apple Pay charged the card, native Apple Pay will charge it too, assuming the signed TestFlight build actually carries the `com.apple.developer.in-app-payments` entitlement (which is exactly what this build is meant to verify).

## Plan — improve card-decline observability + reduce false positives

Only touches manual-card error surfacing and one PaymentIntent field. No changes to Apple Pay, Connect routing, fees, or native.

### 1. Surface the real Stripe decline code

In `src/pages/Checkout.tsx` (`handleCardConfirm` around line 517–534 and `handleSavedCardConfirm` around line 547–564):
- Log `error.code`, `error.decline_code`, `error.type`, and `paymentIntent?.last_payment_error` to `error_logs` via the existing error-logging helper.
- Show a human toast that maps the top decline codes to actionable text:
  - `insufficient_funds` → "Not enough funds on this card."
  - `card_velocity_exceeded` / `card_not_supported` → specific copy
  - `do_not_honor` / `generic_decline` / everything else → "Your bank declined this card. Try Apple Pay or contact your bank and mention the merchant 'FLEA'."
- Keep the fallback string unchanged when Stripe returns no code.

### 2. Send billing postcode with the PaymentMethod

In `src/components/checkout/CardDetailsSheet.tsx` (`handleSubmit`, line 82–86):
- Pull the buyer's saved postcode from `buyer_addresses` (already loaded elsewhere on Checkout) and pass it into `billing_details.address.postal_code` and `billing_details.address.country: 'AU'` on `stripe.createPaymentMethod`.
- AVS postcode match reduces `generic_decline` and `do_not_honor` rates on AU-issued cards significantly. Costs nothing, no UI change.

### 3. One-line PaymentIntent tweak

In `supabase/functions/stripe-connect-payment-intent/index.ts` (`paymentIntents.create` at line 223):
- Add `payment_method_options: { card: { request_three_d_secure: 'automatic' } }` so issuers that want to challenge a manual entry are given the option instead of hard-declining. `automatic_payment_methods.enabled: true` already handles wallets — this is additive.

### 4. Admin visibility

The extra fields written to `error_logs` (decline_code, code, last_payment_error) will show up in the existing Admin → Error Logs view without any UI work.

## What this does NOT change

- No changes to Apple Pay, Google Pay, `WalletPaySheet`, `stripe-webhook`, `stripe-connect-checkout`, Connect fee math, coupon logic, or any native/iOS file.
- No fee change. No key change.
- No UI redesign of the card sheet.

## Files touched

- `src/pages/Checkout.tsx` — decline-code mapping + logging in `handleCardConfirm` / `handleSavedCardConfirm`
- `src/components/checkout/CardDetailsSheet.tsx` — pass postcode + country to `billing_details.address`
- `supabase/functions/stripe-connect-payment-intent/index.ts` — add `payment_method_options.card.request_three_d_secure: 'automatic'`

## Expected outcome

- Next manual-card attempt shows a specific reason and logs the Stripe decline code so we know whether it's the issuer, AVS, 3DS, or funds.
- AU-issued cards with correct postcode should see fewer `generic_decline`s.
- If the bank keeps declining, the toast will tell you it's the bank — try a different card, or use Apple Pay (which we've confirmed works).

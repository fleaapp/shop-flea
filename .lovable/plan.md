Rip out the custom native Apple Pay path and replace it with Stripe's standard native PaymentSheet — a native iOS pop-up sheet (not Safari, not an in-app browser) that shows Apple Pay, card, and Link in one Stripe-managed UI.

## What gets removed

- Custom native Apple Pay call sequence in `src/pages/Checkout.tsx` (preflight, `createApplePay`, `presentApplePay`, native failed-event listener).
- Custom wallet picker path that routes to Apple Pay directly (`WalletPaySheet`, Apple-Pay-only branches in `PaymentMethodPicker`).
- Diagnostics/prewarm/hidden sheet code: `src/lib/applePayDiagnostics.ts` usage, any Stripe prewarm.
- Custom `stripeAccount = nil` / SDK pin patch residue in `scripts/patch-native-capacitor-packages.mjs` (keep only the push-notifications APNs bridge patch).

## What gets added

A single native Stripe PaymentSheet flow in `src/pages/Checkout.tsx`:

1. Call `stripe-connect-payment-intent` edge function to get `paymentIntentClientSecret`, `ephemeralKey`, `customer`.
2. `Stripe.initialize({ publishableKey })`.
3. `Stripe.createPaymentSheet({ paymentIntentClientSecret, customerId, customerEphemeralKeySecret, merchantDisplayName: 'Flea', applePay: { merchantId: 'merchant.com.finditonflea.app', merchantCountryCode: 'AU' }, style: 'alwaysLight' })`.
4. `Stripe.presentPaymentSheet()` → native bottom sheet appears.
5. On success → call `finalize-checkout`.
6. On cancel → close silently. On failure → single Flea-branded toast.

## Backend

- `stripe-connect-payment-intent`: keep `on_behalf_of` + `transfer_data.destination` intact (matches working build). Add ephemeral key creation for the buyer customer so PaymentSheet can save/reuse cards.
- No changes to fees, coupons, `finalize-checkout` totals, or seller transfer logic.

## What stays untouched

- `capacitor.config.ts` (status bar overlay, transparent background, safe areas).
- `ios-native/App.entitlements` (Apple Pay merchant id already present).
- Status bar, footer colour, drawer, app shell, safe-area code.
- Push notifications pipeline.

## UI change in checkout

- Remove the "Apple Pay / Google Pay / Card" picker on native.
- Replace with a single "Pay" button that opens the native Stripe PaymentSheet — Apple Pay, card, and Link appear inside the sheet, chosen by the user there.
- Web checkout unchanged.

## Verification

- Frontend typecheck.
- Confirm removed files/code no longer referenced.
- TestFlight rebuild steps:
  ```bash
  git pull
  npm run build
  npx cap sync ios
  npx cap open ios
  ```
  Bump Build number → Archive → upload.

## Honest limitation

PaymentSheet's Apple Pay row only shows on a real device signed into iCloud with a card in Wallet, on a build signed with the Apple Pay entitlement. That entitlement is already in `App.entitlements`, so no cert/portal work is needed — but final confirmation has to be on TestFlight, not preview.
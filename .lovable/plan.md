## Goal
Restore Apple Pay by routing it through Stripe's PaymentSheet (which brokers Apple's native sheet on Stripe's certificate). Manual card entry stays in the Flea-native UI. No Apple Pay Processing Certificate work needed.

Buyer still sees the standard Apple Pay sheet (Face ID, card picker, double-click) — it's presented by Apple, just initialized by Stripe's SDK instead of directly by us.

## Scope
- Apple Pay tap in checkout → Stripe PaymentSheet with Apple Pay enabled.
- Manual card entry → unchanged (stays in `CardDetailsSheet`, native Flea UI).
- Google Pay / web Apple Pay (PWA) → unchanged (already works).

## Changes

### 1. `src/pages/Checkout.tsx`
- When user taps Apple Pay on native iOS:
  - Create PaymentIntent via existing `stripe-connect-payment-intent` edge function (no backend change needed).
  - Call `Stripe.createPaymentSheet({ paymentIntentClientSecret, merchantDisplayName: "Flea", applePay: { merchantId: "merchant.com.finditonflea.app", countryCode: "AU" } })`.
  - Call `Stripe.presentPaymentSheet()`.
  - On success → same finalize-checkout flow as today.
  - On cancel/error → same error surface as today (uses `cardDeclineHandler`).
- Remove the direct `Stripe.createApplePay` / `presentApplePay` path on native. Keep it for web PWA (where it currently works).

### 2. `src/lib/applePayDiagnostics.ts`
- Simplify: on native, availability is now decided by Stripe's SDK, so preflight just checks `Stripe.isApplePayAvailable()` and shows the button accordingly. Remove the entitlement-specific messaging.

### 3. `scripts/setup-ios-native.sh`
- Keep Apple Pay capability + merchant ID in entitlements (Stripe's SDK still needs the entitlement present to open the sheet).
- No certificate steps required.

### 4. Native Xcode (user-side, one-time)
- Apple Pay capability must stay checked with `merchant.com.finditonflea.app` selected.
- No Payment Processing Certificate needed for this path — you can skip the CSR upload you were doing.

## What stays the same
- Backend PaymentIntent creation (`stripe-connect-payment-intent`).
- Connect account routing, fees, coupon logic, finalize-checkout.
- Manual card UI, 3DS, AVS postcode handling.
- PWA Apple Pay (already working via direct path).

## Verification
1. Build & archive → install on device.
2. Tap Apple Pay in checkout → Apple's native sheet opens (presented by Stripe SDK).
3. Confirm with Face ID → order finalizes → single push notification.
4. Test manual card → still uses Flea-native `CardDetailsSheet`.
5. Test on PWA → Apple Pay still works via existing web path.

## Technical notes
- `@capacitor-community/stripe` `createPaymentSheet` / `presentPaymentSheet` is the API used.
- The sheet Apple shows is Apple's PassKit sheet — visually identical to what buyers expect. Stripe only controls the line-item summary rendering, which is minimal on the Apple Pay sheet itself.
- No changes to Stripe Dashboard, no certificate, no provisioning profile regeneration.
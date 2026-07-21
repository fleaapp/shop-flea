## Switch Apple Pay to direct PassKit (no Stripe sheet)

You're right — Stripe brokers the Apple Pay certificate under the hood in both flows. The Stripe PaymentSheet's Apple Pay button just calls PassKit with Stripe's cert; the plugin's direct `createApplePay` / `presentApplePay` uses the same plumbing. No cert upload from us needed.

### What went wrong last time

When we first tried `createApplePay`, PassKit threw "Apple Pay Is Not Available in Flea". That was almost certainly because:

1. `merchant.com.finditonflea.app` wasn't registered in the Stripe Dashboard → Settings → Payments → Apple Pay list. Stripe blocks the direct call if the merchant id isn't registered against your account, even though it works through their PaymentSheet (which uses a Stripe-owned merchant id transparently).
2. Or the Apple Pay capability / entitlement in Xcode wasn't linked to that exact merchant id in the Release signing profile.

Both are fixable without any Payment Processing Certificate upload.

### Plan

**Code change — `src/pages/Checkout.tsx` (lines 308–367):**

Replace the current `createPaymentSheet` / `presentPaymentSheet` iOS branch with the direct Apple Pay path:

```ts
await Stripe.isApplePayAvailable(); // throws if unavailable
await Stripe.createApplePay({
  paymentIntentClientSecret: pi.clientSecret,
  paymentSummaryItems: [{ label: 'Flea', amount: totalAud }],
  merchantIdentifier: APPLE_PAY_MERCHANT_ID,
  countryCode: 'AU',
  currency: 'AUD',
});
const { paymentResult } = await Stripe.presentApplePay();
```

Handle three outcomes: `Completed` → `handlePaymentSuccess`, `Canceled` → toast, anything else → `mapCardDeclineMessage` + `logCardDecline`.

**No fallback to PaymentSheet.** If Apple Pay isn't available on the device, surface a clear toast telling the buyer to use Add new card — never open the Stripe sheet.

**Diagnostics on failure:** on any non-Completed result, log to `error_logs` via `logApplePayDiagnostic` with the merchant id, PaymentIntent id, and raw error message so we can see exactly why PassKit refused (e.g. `not_registered_with_stripe`, `no_supported_cards`, `entitlement_missing`).

### One-time Stripe dashboard step (you do this, no code)

Confirm the merchant id is registered on the LIVE account:

- Stripe Dashboard → Settings → Payments → Apple Pay → **Add new application**
- Enter `merchant.com.finditonflea.app`
- Save. That's it — no CSR, no `.cer` upload needed for the iOS in-app flow. Stripe uses their own processing certificate.

If that merchant id is already listed, nothing to do.

### Xcode check (once)

In the Release scheme's Signing & Capabilities:

- Apple Pay capability present
- `merchant.com.finditonflea.app` ticked in the merchant list

`ios-native/App.entitlements` already declares this; just confirm the checkbox in Xcode matches on the Release profile.

### Files touched

- `src/pages/Checkout.tsx` — only the iOS Apple Pay branch inside `handleNativeWalletConfirm` (~60 lines).

Nothing else changes. Manual card entry and web wallet paths stay as-is.

## Confirmed

I checked the current code for lingering Apple Pay speed-up / prewarm changes.

The native Apple Pay path is currently back to the last known working sequence:

```text
Stripe.initialize({ publishableKey })
Stripe.createPaymentSheet(...)   // init only, never presented
Stripe.createApplePay(...)
Stripe.presentApplePay()
```

I also confirmed:
- No visible PaymentSheet is presented in the Apple Pay path.
- The `livemode` key mismatch check is now non-blocking and only logs.
- `runApplePayPreflight(...)` is now non-blocking and only logs diagnostics.
- Native Stripe initialization is locked to the platform publishable key only, not a seller/connected account.
- The backend still returns `clientStripeAccountId: null`, so connected-account native init is not active.
- The amount sent to Apple Pay is divided by 100, so the previous 100× total issue is not present in this path.

## Remaining risk I found

There is still one leftover from the diagnostic work: `runApplePayPreflight(...)` still calls `Stripe.isApplePayAvailable()` asynchronously after initialization. It no longer blocks Apple Pay, but it still touches the native Stripe Apple Pay availability API immediately before `createPaymentSheet -> createApplePay -> presentApplePay`.

Because the goal is to return exactly to the version that worked before the speed-up/diagnostic changes, I would remove that preflight call entirely from the live Apple Pay path rather than keep it as a background diagnostic.

## Plan

1. Remove `runApplePayPreflight(...)` from `handleNativeWalletConfirm` so nothing extra touches native Apple Pay before the working four-call sequence.
2. Keep the non-blocking `livemode` log only; it does not interrupt checkout.
3. Keep `Stripe.initialize({ publishableKey })` with no `stripeAccount`.
4. Keep `createPaymentSheet` as init-only and never present it.
5. Keep direct `createApplePay -> presentApplePay` unchanged.
6. Leave the persistent checkout error panel in place so the next archive shows the exact failing stage if Apple Pay still fails.
7. Re-read the final Apple Pay block after the change and verify the sequence is exactly:

```text
initialize
createPaymentSheet init only
createApplePay
presentApplePay
```

No prewarm, no preflight, no visible sheet, no deep links, no certificate work.
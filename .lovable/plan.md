## Correction

You’re right, and I read back the earlier working config.

The setup that worked ("Apple pay is working now") was this exact order in `src/pages/Checkout.tsx` → `handleNativeWalletConfirm`:

```text
Stripe.initialize (publishable key only)
Stripe.createPaymentSheet (never presented — used only to register Apple Pay with the native SDK, with clientSecret + customerId + ephemeralKey)
Stripe.createApplePay
Stripe.presentApplePay
```

That pattern is still present in the code. So the fix is NOT to rip it out. The fix is to remove things that were added around it during the speed-up work and later diagnostics, which are the likely regressions.

## What I will actually change

### 1. Keep the working Apple Pay pattern intact
- Do not remove `createPaymentSheet` (init only).
- Do not remove `createApplePay` → `presentApplePay`.
- Do not add or restore a visible provider/Link sheet.
- Do not add deep links.
- Do not touch certificates or Xcode capability.

### 2. Remove or neutralize post-"working" additions that can silently block Apple Pay
Audit these and remove/soften only where they can suppress the working path:

- `runApplePayPreflight(APPLE_PAY_MERCHANT_ID)` — if this returns `!ok` for a valid device/setup, Apple Pay never opens. Verify what it actually checks. If it can produce false negatives on real devices (for example checks that are stricter than the working build had), soften it to a non-blocking log only, or remove the block.
- `livemode` publishable-key vs payment-intent mismatch guard — verify it isn’t rejecting a live/live pair due to a stale `pi.livemode` field. If it can’t be trusted, downgrade it from a hard toast/return to a log.
- `Stripe.initialize({ stripeAccount: pi.clientStripeAccountId })` — backend currently returns `clientStripeAccountId: null`, so this branch stays off. Confirm this and lock it as `undefined` for native Apple Pay so a future backend change can’t silently re-enable a connected-account init that breaks Apple Pay.
- Any residual pre-warm/prefetch of PaymentIntent, PaymentSheet, or Stripe SDK added during the speed-up — verified only one `Stripe.initialize` call remains in the Apple Pay path; confirm nothing warms it earlier from another module and pass through unchanged if it does.

### 3. Fix the `stripe-connect-payment-intent` 500 finding
- Keep the current idempotency retry logic.
- Convert expected buyer/seller/cart failures from generic 500 to typed responses (400/402/409 with `errorCode` + `message`).
- Keep true infrastructure errors as 500 but include a safe message.

### 4. Make the failure visible on-screen after Apple Pay closes
- Add a persistent checkout error panel that appears after any Apple Pay or card failure and does not depend on toasts, so we can actually see the stage and reason next time.
- Every catch path in `handleNativeWalletConfirm` and manual card flow must set this state before returning.

### 5. Verification before saying it is done
- Re-read `handleNativeWalletConfirm` end-to-end and confirm the four-call sequence (initialize → createPaymentSheet → createApplePay → presentApplePay) is intact.
- Confirm no new blocking guard sits between those calls.
- Confirm the persistent checkout error panel is wired to every failure path.
- Confirm the payment intent function no longer returns 500 for expected checkout conditions.

## Not doing

- No certificate work.
- No Xcode capability changes.
- No removal of the working `createPaymentSheet` init step.
- No deep links.
- No visible provider/Link sheet.
- No repeating the earlier setup loop.
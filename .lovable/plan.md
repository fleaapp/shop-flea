## Goal

Recreate the exact Apple Pay wiring from when it last worked: initialize Stripe via the PaymentSheet config path (which is what actually registered Apple Pay correctly with the native Stripe SDK), but never present the sheet — go straight into Apple's native Apple Pay sheet.

You will not see the Stripe / Link sheet at any point. It's only used as an initializer, then bypassed.

## Change — `src/pages/Checkout.tsx`, iOS branch of `handleNativeWalletConfirm`

1. Keep the existing calls that must not change: `Stripe.initialize`, the key-mode guard, `runApplePayPreflight`, and the amount-mismatch guard.

2. Restore the PaymentSheet initializer before Apple Pay (this is the step that was removed in the "speed up Apple Pay" change and is what registered Apple Pay against the Stripe SDK correctly):
   ```
   await Stripe.createPaymentSheet({
     paymentIntentClientSecret: pi.clientSecret,
     customerId: pi.customerId,
     customerEphemeralKeySecret: pi.ephemeralKey,
     enableApplePay: true,
     applePayMerchantId: 'merchant.com.finditonflea.app',
     countryCode: 'AU',
     merchantDisplayName: pi.merchantDisplayName || 'Flea',
     returnURL: 'flea://stripe-redirect',
     style: 'alwaysLight',
   });
   ```
   The sheet is never presented — no `Stripe.presentPaymentSheet()` call.

3. Immediately after that, keep the direct Apple Pay path (unchanged):
   ```
   await Stripe.createApplePay({
     paymentIntentClientSecret: pi.clientSecret,
     paymentSummaryItems: [{ label: pi.merchantDisplayName || 'Flea', amount: applePayTotalAud }],
     merchantIdentifier: 'merchant.com.finditonflea.app',
     countryCode: 'AU',
     currency: 'AUD',
   });
   const { paymentResult } = await Stripe.presentApplePay();
   ```
   Success/cancel/failure handling stays exactly as it is today.

4. Add `ephemeralKey` and `customerId` to the `pi` type in `handleNativeWalletConfirm` and to the return type of `createPaymentIntent` so the initializer call above compiles. The backend function `stripe-connect-payment-intent` already returns both — no server changes.

## What this does NOT change

- No visible Stripe / Link sheet — `presentPaymentSheet` is never called.
- No changes to card / saved-card / web wallet paths.
- No changes to `stripe-connect-payment-intent`, entitlements, `setup-ios-native.sh`, or push notifications.
- No changes to the amount, fees, or coupon logic.

## Verification

- Typecheck runs automatically after the edit.
- On device: tap Apple Pay → Apple's native sheet opens directly, no Stripe / Link sheet ever visible. Complete payment with a card in Wallet and confirm the order lands in the success screen.
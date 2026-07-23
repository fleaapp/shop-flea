## Plan: make native PaymentSheet checkout reliable

1. **Stop treating this as a status/footer issue**
   - No changes to `capacitor.config.ts`, status bar setup, footer/safe-area styling, splash, or native shell colours.
   - Keep the current native UI shell exactly as-is.

2. **Fix the PaymentSheet Apple Pay configuration path**
   - Update native PaymentSheet setup in `src/pages/Checkout.tsx` so it passes the full required Stripe PaymentSheet options cleanly:
     - `paymentIntentClientSecret`
     - `customerId`
     - `customerEphemeralKeySecret`
     - `merchantDisplayName`
     - `enableApplePay: true` only on iOS
     - `applePayMerchantId`
     - `countryCode: 'AU'`
     - `returnURL`
   - Add PaymentSheet failed/failed-to-load listeners so the app records the exact native error instead of only showing “not working”.
   - Keep native checkout as one Stripe sheet: Apple Pay, saved cards, and card entry in the same native bottom sheet.

3. **Remove likely incompatible PaymentIntent fields for PaymentSheet Apple Pay**
   - In `supabase/functions/stripe-connect-payment-intent/index.ts`, switch the PaymentIntent for mobile PaymentSheet back to a platform destination-charge shape that is simpler for Apple Pay:
     - keep `transfer_data.destination`
     - keep `application_fee_amount`
     - remove `on_behalf_of`
   - Bump the PaymentIntent idempotency version so old cached PaymentIntent shapes cannot be reused.
   - Keep buyer fee, FREEFLEA coupon logic, seller routing, and order metadata unchanged.

4. **Make failure visible and traceable**
   - If PaymentSheet creation or presentation fails, show the checkout error on-screen with the stage and payment reference.
   - Log the raw native PaymentSheet failure through the existing decline/error logging path so future reports have usable evidence.

5. **Deploy only the payment function after code changes**
   - Deploy `stripe-connect-payment-intent` after the backend edit.
   - Do not deploy or change unrelated functions.

6. **Validation**
   - Run a frontend typecheck/build validation after edits.
   - Verify the code no longer uses the old direct Apple Pay preflight/present flow on native.

## What this does not change

- No status bar changes.
- No footer colour changes.
- No safe-area/layout changes.
- No full rollback.
- No certificate-focused native PassKit implementation.
- No Safari or browser checkout.
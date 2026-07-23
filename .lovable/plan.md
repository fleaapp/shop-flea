Confirmed by your signed binary:
```text
com.apple.developer.in-app-payments = merchant.com.finditonflea.app
com.apple.developer.team-identifier = MAYU87849K
application-identifier = MAYU87849K.com.finditonflea.app
aps-environment = development
```
Apple Pay entitlement, push, Sign in with Apple, and associated domains are all present in the installed app. This is 100% a runtime issue in the native Apple Pay flow — no certificate, portal, or Xcode capability work is needed.

## Plan

1. **Strip the hidden PaymentSheet init from native Apple Pay in `src/pages/Checkout.tsx`**
   - Delete the `Stripe.createPaymentSheet(...)` call that runs silently before Apple Pay.
   - Native wallet flow becomes exactly:
     ```text
     Stripe.initialize({ publishableKey: platform key })
     Stripe.createApplePay({ paymentIntentClientSecret, paymentSummaryItems, merchantIdentifier, countryCode })
     Stripe.presentApplePay()
     ```

2. **Lock the merchant identifier to the exact string from the signed entitlement**
   ```text
   merchant.com.finditonflea.app
   ```

3. **Never pass a connected account to `Stripe.initialize` in the buyer flow**
   - Keep buyer confirmation on the platform account (destination charge already set server-side with `clientStripeAccountId: null`).

4. **Add proof-level Apple Pay diagnostics**
   - Log the exact failing stage into `error_logs`:
     ```text
     stage: initialize | createApplePay | presentApplePay
     merchantIdentifier
     paymentIntentId
     platform
     native error message and code
     ```
   - So if it fails again, the admin log names the cause instead of guessing.

5. **Sweep out remaining “fast Apple Pay” leftovers**
   - Search the native wallet code path for and remove any of:
     ```text
     createPaymentSheet
     prewarm
     preflight
     stripeAccount on initialize
     ```

6. **Local rebuild steps after the change (no cert or Xcode capability work)**
   ```text
   git pull
   npm install
   npm run build
   npx cap sync ios
   bash scripts/setup-ios-native.sh
   archive from Xcode
   ```

Approve this plan and I will implement the changes.
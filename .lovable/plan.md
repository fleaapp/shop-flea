## Plan

1. **Keep the current Flea-native checkout**
   - Do not switch to Stripe’s full PaymentSheet UI.
   - Keep the existing Flea checkout screen, Flea payment selector, Flea card sheet, and native Apple Pay button flow.

2. **Fix the Apple Pay setup that likely changed during the Cloud cutover**
   - Verify the app is initializing native Apple Pay against the same payment account/key that has Apple Pay enabled.
   - The Cloud cutover changed backend payment secrets, so the most likely break is now: the app is creating PaymentIntents under a different payment account than the one that previously had the Apple Pay merchant/certificate setup.
   - Add a backend-safe diagnostic response from `stripe-config` showing non-secret payment account metadata only, so we can confirm the live account used by Cloud matches the intended Flea payment account.

3. **Strengthen the native Apple Pay initialization only**
   - Keep using `@capacitor-community/stripe` direct Apple Pay.
   - Initialize the native Stripe plugin with both the publishable key and `merchantIdentifier: merchant.com.finditonflea.app` before Apple Pay checks and presentation.
   - Keep the existing `createApplePay` / `presentApplePay` path.

4. **Add real native Apple Pay failure logging**
   - The Admin Error Log is empty because the current failure is a native iOS PassKit dialog, not a normal JS crash.
   - When Apple Pay preflight/create/present fails, send the sanitized diagnostic into the existing app error logger so the next TestFlight attempt appears in Admin Error Logs.
   - Include merchant ID, platform, payment account ID, and the native error category, but no secrets.

5. **Make the setup script catch the exact local issue before Archive**
   - Update the iOS setup verification to check that the generated Xcode entitlement file contains `merchant.com.finditonflea.app`.
   - Print a clear pass/fail result so you can confirm the archive is signed with the Apple Pay entitlement before uploading.

6. **After implementation, you’ll run one clean native push**
   - `git pull`
   - `npm install`
   - `npm run build`
   - `npx cap sync ios`
   - run the native setup script if the `ios/` project was regenerated
   - Archive again in Xcode

## What this does not change

- No Stripe sheet.
- No external checkout.
- No deep links.
- No change to seller/buyer fee logic.
- No change to marketplace transfer/application fee logic.
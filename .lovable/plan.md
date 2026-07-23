# Plan: Use your own Apple Pay merchant ID with Stripe (Option B)

## What this means

- We keep `merchant.com.finditonflea.app` hardcoded in the app.
- You register that merchant ID in your Apple Developer account.
- Stripe generates a Certificate Signing Request (CSR), Apple issues an Apple Pay Payment Processing certificate, and Stripe uses that certificate to encrypt Apple Pay tokens for your app.
- Bank statement text stays as "Flea" (that is set separately in Stripe).
- New ongoing responsibility: the Apple Pay certificate must be renewed once a year. If it expires, Apple Pay will stop working.

## Why this should fix the current failure

Your signed iOS build already contains the correct entitlement (`merchant.com.finditonflea.app`), so PassKit recognises the merchant ID. The missing piece is the Stripe-side payment-processing certificate that pairs that merchant ID with your Stripe account. Without it, PassKit/Stripe cannot complete the Apple Pay flow, which matches the "Apple Pay Is Not Available" / "Payment Not Completed" behaviour you are seeing.

## Part 1 — Apple Developer (you do this)

1. Register the merchant ID
  - Go to [https://developer.apple.com/account/resources/identifiers/add/merchant](https://developer.apple.com/account/resources/identifiers/add/merchant)
  - Description: `Flea`
  - Identifier: `merchant.com.finditonflea.app`
  - Continue → Register
2. Enable Apple Pay on the App ID
  - Go to [https://developer.apple.com/account/resources/identifiers/list/bundleId](https://developer.apple.com/account/resources/identifiers/list/bundleId)
  - Click `com.finditonflea.app`
  - Under Capabilities, check **Apple Pay** is enabled.
  - If it asks you to select merchant IDs, select `merchant.com.finditonflea.app`.
3. Create the Apple Pay Payment Processing certificate (using Stripe's CSR)
  - Go to Stripe Dashboard → Settings → Payments → Apple Pay → **iOS Certificate Settings** (direct link: [c](https://dashboard.stripe.com/settings/ios_certificates))
  - Click **Add new application**.
  - Enter `merchant.com.finditonflea.app` and download the CSR file Stripe gives you.
  - Go to [https://developer.apple.com/account/resources/certificates/add](https://developer.apple.com/account/resources/certificates/add)
  - Certificate Type: **Apple Pay Payment Processing Certificate**
  - Select `merchant.com.finditonflea.app`
  - Upload the CSR you downloaded from Stripe.
  - Download the resulting `.cer` file from Apple.
4. Upload the certificate to Stripe
  - Back in Stripe Dashboard → iOS Certificate Settings, upload the `.cer` file you just downloaded.
  - Wait for the status to show active/verified.
5. Install the certificate locally (so Xcode can use it when signing)
  - Double-click the `.cer` file; it should appear in Keychain Access under "My Certificates" or "Certificates".
  - If you build on a different Mac (e.g. CI), the certificate does **not** need to be on that machine for the app to run Apple Pay; the certificate lives in Stripe's dashboard. It only needs to be in your Keychain if you are testing Apple Pay on a physical device from that Mac.

## Part 2 — Stripe Dashboard (you do this)

1. Confirm the merchant ID is listed at [https://dashboard.stripe.com/settings/ios_certificates](https://dashboard.stripe.com/settings/ios_certificates) and shows as active.
2. No changes are needed to Payment Method Configurations or Apple Pay domain settings.

## Part 3 — Code changes (I will do this)

1. Re-enable the native Stripe patches in `scripts/patch-native-capacitor-packages.mjs`
  - Pin the Stripe iOS SDK to an exact version (`25.9.0`) so future `npx cap sync ios` does not silently upgrade it.
  - Patch `StripePlugin.swift` to reset `STPAPIClient.shared.stripeAccount = nil` when no connected account is passed. This fixes the stale-account context that breaks platform-level Apple Pay after visiting Seller Dashboard / Settle Balance.
2. Update `scripts/setup-ios-native.sh`
  - Add a verification line that prints the pinned SDK state.
  - Keep the existing entitlement and APNs checks.
3. Tighten `src/lib/applePayDiagnostics.ts`
  - Keep the preflight but improve the error messages so a missing certificate shows a clear "Apple Pay certificate is not active" message instead of the generic system alert.
4. No changes to `capacitor.config.ts`, status bar, footer, splash, or safe-area styling.

## Part 4 — Build and verify (you do this)

1. Pull the updated code.
2. Run:
  ```bash
   npm install
   npm run build
   npx cap sync ios
   ./scripts/setup-ios-native.sh
   npx cap open ios
  ```
3. In Xcode:
  - Select the App target → Signing & Capabilities.
  - Confirm **Apple Pay** is listed and `merchant.com.finditonflea.app` is selected.
  - Bump the build number.
  - Archive and upload to TestFlight/App Store.
4. After archiving, verify the signed entitlements:
  ```bash
   APP="$(ls -td ~/Library/Developer/Xcode/Archives/*/*.xcarchive | head -1)/Products/Applications/App.app"
   codesign -d --entitlements :- "$APP" | grep -A6 'com.apple.developer.in-app-payments'
  ```
   Output must include `merchant.com.finditonflea.app`.
5. Install the TestFlight build on a device with a card in Wallet and attempt checkout with Apple Pay.

## What I will not change

- Status bar, footer, splash, or safe-area styling.
- The direct Stripe `createApplePay` / `presentApplePay` checkout path.
- Any other checkout logic (fees, coupons, shipping bundles).

## Risks / fallback

- If Apple does not let you create the certificate, or Stripe rejects the upload, we can switch back to Option A (remove the hardcoded merchant ID and let Stripe use its umbrella merchant ID).
- You must renew the certificate annually; I will add a reminder note in the project memory.

## Approval needed

Please confirm you want to proceed with Part 1 (Apple Developer + Stripe certificate steps) and Part 3 (code changes).
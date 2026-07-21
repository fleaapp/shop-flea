I’ve confirmed two important current facts:

- The app code and `ios-native/App.entitlements` both use `merchant.com.finditonflea.app`.
- The live backend `stripe-config` is currently returning a live publishable key but `livemode: false`, which means the Cloud private payment key/config is still test-mode while the app is trying to use live payments. That is configuration drift from the Cloud move and needs fixing.

Plan:

1. Fix Cloud payment key mode mismatch
   - Update the Cloud Stripe/private payment key so the backend and publishable key are both live.
   - Re-check `stripe-config` afterwards; it must return `livemode: true` with the live publishable key.

2. Add a native runtime entitlement checker in the iOS app
   - Add a tiny Capacitor iOS plugin that reads the signed app’s actual `com.apple.developer.in-app-payments` entitlement at runtime.
   - Before showing Apple Pay, call this checker from checkout.
   - If the signed build does not actually contain `merchant.com.finditonflea.app`, show a Flea toast and write an admin error log before PassKit opens its system alert.

3. Initialize the Stripe native plugin with the connected account context
   - The current native code creates the PaymentIntent as a Connect charge for the seller, but `Stripe.initialize()` only receives the publishable key.
   - Pass the seller account ID to native initialization as `stripeAccount` so native Apple Pay confirmation uses the same Connect account context as the PaymentIntent.

4. Harden the local Xcode verification script
   - Update `scripts/setup-ios-native.sh` to verify the generated iOS project has `CODE_SIGN_ENTITLEMENTS` wired for every build config.
   - Add a command that checks the archived `.app` entitlements after archive, not just the source plist, because the source file can be correct while the signed build is wrong.

5. Deployment/test steps after code changes
   - Deploy the updated payment config/function if needed.
   - You’ll run the fresh iOS sequence locally: `git pull`, `npm install`, `npm run build`, `npx cap sync ios`, `bash scripts/setup-ios-native.sh`, then archive.
   - If the runtime checker says entitlement missing, the fix is Apple provisioning/profile regeneration; if entitlement passes but Apple Pay still fails, the remaining target is Stripe live Apple Pay certificate/merchant setup for `merchant.com.finditonflea.app` on the live account.
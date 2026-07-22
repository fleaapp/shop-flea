## Confirmed findings

- **Push notifications:** the Cloud database currently has one iOS push token, and it belongs to `@jcsbh`. There is still **no saved iOS token for `@sarahhearn2`**, so comment alerts can appear in-app while native push delivery has nothing to send to.
- **Push root cause:** native registration depends on APNs callbacks being forwarded from the generated iOS `AppDelegate.swift`. That forwarding is only added by `scripts/setup-ios-native.sh`, so it can be wiped out or skipped after native sync/rebuild. This explains why permission can be on but no token is saved.
- **Apple Pay:** PWA Apple Pay works, so the payment intent, amount, and backend key path are usable. The failing path is native iOS only.
- **Apple Pay likely native bug:** the native Stripe plugin keeps `STPAPIClient.shared.stripeAccount` if it was ever initialized with a connected account. This can make native Apple Pay confirm a platform destination-charge PaymentIntent with the wrong account context, while PWA still works.
- **Existing native setup:** `ios/` is not committed in this project; it is generated locally. Fixes that only patch generated iOS files are fragile unless we also patch the npm/native packages or the setup script.

## Plan

1. **Make push registration independent of the generated AppDelegate patch**
   - Add a persistent patch for `@capacitor/push-notifications` so the iOS plugin installs the APNs callback forwarders itself when it loads.
   - Keep the existing `setup-ios-native.sh` AppDelegate patch as a backup, but stop relying on it as the only path.
   - This should make `PushNotifications.register()` produce the JS `registration` event and save the APNs token even after `cap sync` regenerates the native app.

2. **Keep native token registration aggressive but safe**
   - Leave the existing foreground/mount registration checks in place.
   - If permission is granted but Cloud has no iOS token, force APNs registration again.
   - Keep the timeout/error logging so we can see if the native callback still fails.

3. **Fix native Apple Pay account-context leakage**
   - Add a persistent patch for `@capacitor-community/stripe` so `Stripe.initialize()` clears `STPAPIClient.shared.stripeAccount` when no connected account is provided.
   - This matches the current backend response where `clientStripeAccountId` is intentionally `null` for platform destination charges.
   - This avoids native Apple Pay confirming the PaymentIntent under a stale connected-account context.

4. **Preserve the hidden PaymentSheet-initialized Apple Pay setup**
   - Keep `createPaymentSheet()` before `createApplePay()` but do not present the sheet, so users still go directly to Apple Pay with no visible middle sheet.
   - Do not change the PWA/web Apple Pay path, since it already works.

5. **Verify with real signals after implementation**
   - Confirm the patch files are applied by `patch-package`.
   - Deploy any changed push/payment functions only if source changes are needed there.
   - Re-check `push_subscriptions` after a native app open: `@sarahhearn2` must have an iOS token.
   - Trigger a comment notification and confirm the push function reports an APNs send attempt instead of “no subscriptions”.
   - For Apple Pay, confirm native checkout no longer uses a stale connected-account Stripe context.

## Technical notes

- The external backend remnants are not the immediate cause of this push failure: the current Cloud push table is what `send-push-notification` reads, and the missing row is specifically for the recipient account.
- The native package patches are the key change because local generated iOS files are not committed and can be overwritten by native sync.
## Diagnosis

The screenshot shows iOS PassKit’s own alert: **“Apple Pay Is Not Available in ‘Flea’ — Check the settings for this app and make sure it was designed to use Apple Pay.”**

That message is not caused by the footer/status bar and not caused by checkout UI layout. It is thrown by iOS when Apple Pay is being invoked from a build that iOS does not consider Apple-Pay-enabled for the requested merchant.

The current source has the merchant in `ios-native/App.entitlements`, but there is a high-risk change in the native setup script: it now rewrites Xcode target capabilities and entitlement wiring in a new way compared with the known working build. If that script signs/archives with a profile that does not include the Apple Pay merchant entitlement, Stripe’s PaymentSheet will still open but Apple Pay inside it will fail exactly like the screenshot.

There is also one app-side issue to correct: `PaymentSheet` is currently configured with Apple Pay enabled, but without the older working Apple Pay availability guard and without verifying the signed runtime state before presenting Apple Pay to the user.

## Plan

1. **Do not touch status bar, footer, safe area, splash, or Capacitor shell colours.**
   - No edits to the visual native shell.
   - No rollback of the footer/status-bar fixes.

2. **Revert the iOS Apple Pay entitlement setup script to the known working wiring style, while keeping unrelated push fixes.**
   - Restore simple `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` wiring from the working build.
   - Stop rewriting Xcode `SystemCapabilities` for Apple Pay in the script, because the new capability rewrite is the likely regression point.
   - Keep APNs callback forwarding for push notifications.
   - Keep copying `ios-native/App.entitlements` with `merchant.com.finditonflea.app`.

3. **Add a native preflight before opening the Stripe sheet.**
   - On iOS, call Stripe’s Apple Pay availability check before creating/presenting PaymentSheet.
   - If iOS says Apple Pay is unavailable, show a clear in-app checkout error and log the exact failure instead of opening a sheet that immediately triggers the system alert.
   - This will prove whether the signed build is missing Apple Pay entitlement before the buyer reaches PassKit.

4. **Keep the Stripe PaymentSheet path, but make Apple Pay opt-in only when iOS preflight passes.**
   - If Apple Pay preflight passes: create PaymentSheet with Apple Pay enabled.
   - If Apple Pay preflight fails: create PaymentSheet without Apple Pay so manual card/saved-card payment still works, and the app logs the Apple Pay cause.
   - This avoids full checkout failure while we isolate the signing entitlement problem.

5. **Restore PaymentIntent shape to the working Apple Pay-compatible shape.**
   - Re-check `stripe-connect-payment-intent` against the known working build.
   - Keep current business rules: FREEFLEA, buyer fee, bundle shipping, seller routing, negative balance checks.
   - Only adjust payment-intent fields if they differ from the known working Apple Pay shape and could affect native wallet confirmation.
   - Bump the idempotency version only if the PaymentIntent shape changes.

6. **Add a signed-build verification command to the native setup output.**
   - The script already prints a `codesign -d --entitlements` check; keep it prominent.
   - After archive/TestFlight, the signed app must show `com.apple.developer.in-app-payments` containing `merchant.com.finditonflea.app`.
   - If source entitlements have it but signed entitlements do not, the reason is confirmed: the Apple provisioning profile used for the archive does not contain that merchant.

7. **Validation after implementation.**
   - Typecheck/build the frontend.
   - Confirm no status/footer files were changed.
   - Confirm the Stripe sheet no longer blindly presents Apple Pay when the native build says Apple Pay is unavailable.

## Expected result

This finds the actual reason instead of looping: either the signed TestFlight build proves it has the Apple Pay merchant entitlement, or the new preflight/logging proves it does not. Manual card checkout should remain available even when Apple Pay is disabled by the signed iOS build.
## What I found

The local `npm install` failed during `patch-package`, before the native build could be trusted:

- The Push Notifications patch applied, but with a version mismatch warning because the installed package resolved to `@capacitor/push-notifications@8.1.2` while the patch file is named for `8.0.3`.
- The Stripe native patch failed completely for `@capacitor-community/stripe`, so the Apple Pay native fix did not make it into `node_modules`.
- The setup script also reports `Xcode capabilities: NO` even though it says the entitlements file and Apple Pay merchant are present. That means the verification logic or the project patching is not robust enough.

## Plan

1. **Make native dependency versions deterministic**
   - Pin the Capacitor native packages to the exact versions the project is patching instead of using `^` ranges.
   - This prevents `npm install` from silently installing `@capacitor/push-notifications@8.1.2` when the patch expects `8.0.3`.

2. **Replace the fragile Stripe patch with a version-safe native patch**
   - Regenerate or rewrite the `@capacitor-community/stripe` patch against the actual installed `8.1.1` package structure.
   - Keep the intended Apple Pay fix: reset `STPAPIClient.shared.stripeAccount` to `nil` when no connected account is passed, so direct Apple Pay does not inherit a stale connected-account header.
   - Keep the Stripe iOS SDK pinned exactly to `25.9.0` if the package file still supports that patch.

3. **Fix the setup script’s Xcode capability patching**
   - Update `scripts/setup-ios-native.sh` so it inserts `SystemCapabilities` into the exact `TargetAttributes` structure Xcode expects.
   - Make the verification check look for the full capability block, not just grep fragments that can miss or miscount valid output.
   - Keep the script safe: no deleting iOS project files, no resetting Xcode, no changing icons/assets.

4. **Add a clear terminal recovery sequence**
   - Provide the exact commands to run after the fix.
   - Include a clean `node_modules` reinstall only if needed, because the failed patch left local dependencies in an untrusted state.
   - Include a final `codesign` entitlement check after building in Xcode, because that is the only reliable proof the signed native binary has Apple Pay and APNs entitlements.

5. **Do not touch unrelated app logic**
   - No checkout UI changes.
   - No notification business-logic changes.
   - No backend changes.
   - This plan only fixes the native install/build pipeline that currently prevents the Apple Pay and push fixes from actually being included in the iOS app.
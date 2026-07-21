## What I think is happening

This is not caused by the Cloud database itself. The screenshot shows Xcode failing while compiling the native **StripePaymentSheet** Swift package. That package is pulled during `npx cap sync ios` from `@capacitor-community/stripe`, and Xcode/SwiftPM can silently resolve a newer Stripe iOS SDK than the one that worked before.

Because the visible error has no useful Swift line above it, I’m going to stop asking you to dig through Xcode and make the native dependency deterministic.

## Plan

1. **Pin the native Stripe iOS SDK version**
   - Add a valid `patch-package` patch for `@capacitor-community/stripe@8.1.1`.
   - Patch its `Package.swift` so the Stripe iOS dependency resolves to a stable known-good range instead of floating to the newest SDK Xcode finds.
   - This avoids StripePaymentSheet compiling against a newly resolved Stripe package that your local Xcode build did not previously use.

2. **Make the pin survive future syncs**
   - Keep the patch under `patches/` so `npm install` applies it automatically.
   - Do not reintroduce the broken custom Stripe diagnostics patch that caused the earlier `npm install` failure.

3. **Update the iOS setup script notes/output**
   - Add a verification line to `scripts/setup-ios-native.sh` explaining that Stripe iOS is pinned through the package patch.
   - Keep existing Apple Pay entitlements, Sign in with Apple, push, and app icon handling unchanged.

4. **Give you a clean local rebuild sequence**
   - After the patch lands, run locally:

```bash
cd ~/Desktop/shop-flea
git pull
rm -rf node_modules package-lock.json
npm install
rm -rf ios
npm run build
npx cap add ios
npx cap sync ios
bash scripts/setup-ios-native.sh
npx cap open ios
```

5. **If Xcode still shows the same wrapper error**
   - Then the next fix is not Cloud/app code; it is a corrupted SwiftPM/Xcode cache or Xcode beta/compiler issue.
   - The fallback command will be:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf ~/Library/Caches/org.swift.swiftpm
rm -rf ~/Library/org.swift.swiftpm
```

Then reopen Xcode and Archive again.

## Technical details

- I will only touch native dependency configuration and setup documentation.
- I will not change checkout logic, Cloud functions, Apple Pay business logic, fees, or database code.
- The goal is to restore the same kind of stable native Stripe build you had before the Cloud migration work caused repeated `cap sync` / package-resolution churn.

## Expected result

`StripePaymentSheet` stops resolving to an unstable/native-incompatible Stripe iOS package, Xcode compiles the Stripe Swift targets cleanly, and you can archive again without this generic `Command SwiftCompile failed` blocker.
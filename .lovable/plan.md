## What is happening

This is not a payment/onboarding code failure. The app dependencies are present in `package.json`, and the missing products listed are all native Capacitor Swift Package products. This points to Xcode/Swift Package Manager losing or failing to resolve the generated `CapApp-SPM` package after the latest pull/sync.

## Immediate recovery steps for your Mac

1. Quit Xcode completely.
2. From the project folder, run a clean sync:

```bash
cd ~/Desktop/shop-flea
rm -rf ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
rm -rf ios/App/App.xcodeproj/project.xcworkspace/xcuserdata
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
rm -rf ~/Library/Caches/org.swift.swiftpm
npm install
npm run build
npx cap sync ios
npx cap open ios
```

3. In Xcode, wait for package resolution to finish before pressing Archive/Analyze.
4. If it still shows missing package products, use Xcode menu:
   - File > Packages > Reset Package Caches
   - File > Packages > Resolve Package Versions
   - then close and reopen the workspace.

## If the error still returns

I’ll make a project-side fix so this is less likely to recur by adding a dedicated local repair script for iOS package resolution. It will do the safe cleanup above in one command, without touching app code or changing payment/seller onboarding packages.

## Why I do not want to change Stripe/Capacitor packages again

The current app package versions are aligned:

- `@capacitor-community/stripe` is installed.
- Apple sign-in and every Capacitor native plugin named in the error is installed.
- Stripe web packages were already aligned to avoid the npm peer dependency conflict.

Changing versions again is likely to create a new dependency conflict. This specific error is Xcode failing to resolve native package products, not npm missing packages.
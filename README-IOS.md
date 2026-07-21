# iOS native rebuild — recovery cheatsheet

If `ios/` gets wiped, corrupted, or you need a clean rebuild:

```bash
cd ~/Desktop/shop-flea
git pull
rm -rf ios
npx cap add ios
npm run build
npx cap sync ios
bash scripts/setup-ios-native.sh
npx cap open ios
```

Then in Xcode (one-time per Mac):

1. App target → **Signing & Capabilities** → set **Team**.
2. Destination: **Any iOS Device (arm64)**.
3. Product → **Clean Build Folder**.
4. Bump **Build** number.
5. Product → **Archive** → Distribute → App Store Connect.

## What the script applies automatically

- Info.plist usage strings: camera, mic, photo library, photo library add, Face ID.
- `UIBackgroundModes = [remote-notification]` for push.
- `ITSAppUsesNonExemptEncryption = false`.
- `CFBundleDisplayName = Flea`.
- `LSApplicationCategoryType = public.app-category.shopping`.
- Strips any `REVERSED_IOS_CLIENT_ID` URL scheme.
- Copies `ios-native/App.entitlements` into place with all three capabilities:
  - Push Notifications (`aps-environment = production`)
  - Sign in with Apple
  - Apple Pay (`merchant.com.finditonflea.app`)
  - Associated Domains: `applinks:app.finditonflea.com`, `webcredentials:app.finditonflea.com`
- Wires the entitlements file into `App.xcodeproj/project.pbxproj`.
- Installs Flea's native entitlement checker so checkout can detect whether the
  signed app really contains the Apple Pay entitlement before PassKit opens.
- Restores the app icon from your newest local Xcode Archive.

## What you still do in Xcode

Only the Apple Team selection (Apple refuses to let a repo hardcode this).

After Archive, verify the signed app contains Apple Pay before uploading:

```bash
APP="$(find ~/Library/Developer/Xcode/Archives -path '*/Products/Applications/Flea.app' -type d | sort | tail -1)"
codesign -d --entitlements :- "$APP" | grep -A6 'com.apple.developer.in-app-payments'
```

The output must include `merchant.com.finditonflea.app`.

## To edit what's applied

- Entitlements: `ios-native/App.entitlements`
- Info.plist keys: `ios-native/Info.plist.patch.json`
- Script logic: `scripts/setup-ios-native.sh`

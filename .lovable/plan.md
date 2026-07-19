I will commit a one-shot setup script and an entitlements file into the project. After you `git pull`, you run one command and Info.plist keys, all three capabilities, and Associated Domains are applied automatically. No clicking around Signing & Capabilities.

## What I'll add to the project

1. **`ios-native/App.entitlements`** — committed entitlements file listing:
   - `aps-environment = production` (Push Notifications)
   - `com.apple.developer.applesignin = [Default]` (Sign in with Apple)
   - `com.apple.developer.associated-domains` = `applinks:app.finditonflea.com`, `webcredentials:app.finditonflea.com`

2. **`ios-native/Info.plist.patch.json`** — declarative list of Info.plist keys to inject:
   - `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` — with the copy we agreed on
   - `UIBackgroundModes = [remote-notification]`
   - `ITSAppUsesNonExemptEncryption = false`
   - `CFBundleDisplayName = Flea`

3. **`scripts/setup-ios-native.sh`** — one script you run locally after `npx cap add ios`. It:
   - Copies `App.entitlements` into `ios/App/App/`
   - Wires the entitlements file into `App.xcodeproj/project.pbxproj` (`CODE_SIGN_ENTITLEMENTS = App/App.entitlements`)
   - Applies every key from `Info.plist.patch.json` using PlistBuddy
   - Removes any `REVERSED_IOS_CLIENT_ID` block
   - Copies your app icons from the newest Xcode Archive into `Assets.xcassets/AppIcon.appiconset/` and writes a valid `Contents.json`
   - Prints a final summary of what was applied

4. **`README-IOS.md`** — 6-line recovery cheatsheet so this never becomes a scavenger hunt again.

## What you do on your Mac after this pushes

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

Then in Xcode: set Team (this is the only thing Apple forces you to click, because Team is Apple-account-specific) → Any iOS Device (arm64) → Clean Build Folder → bump Build → Archive.

## What's out of scope for this script

- Team ID: Xcode requires a signed-in Apple ID and refuses to accept a hardcoded team from a committed file. This is a 1-click set.
- Splash logo art: I'll restore the FLEA splash image asset in a follow-up once you're unblocked and shipped — not blocking Archive.

Approve this plan and I'll switch to build and push all four files.
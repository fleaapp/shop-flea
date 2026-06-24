# Fix Apple "NSUserTrackingUsageDescription" warning

## Why this is happening

Apple sees `NSUserTrackingUsageDescription` in the iOS binary's `Info.plist`. That key is **only** meant for apps that show the ATT ("Allow Flea to track…") prompt — and once it's present, Apple makes you declare which data types are "Used for tracking" on the App Store product page.

## Why we can just remove it

You're planning to advertise **Flea on Meta and Google** (marketing — paying them to run "Install Flea" ads). That happens on Meta/Google's platforms, not inside Flea. It does **not** involve ATT, does **not** need `NSUserTrackingUsageDescription`, and does **not** require declaring any tracking data.

Flea itself has:
- No in-app ads
- No ad/analytics SDKs
- No cross-app data sharing
- Privacy Policy already states no data is sold to advertisers or brokers

So the key is currently misleading Apple. Remove it.

(If you ever later add an in-app ad SDK like AdMob, or install-attribution SDKs from Meta/Google to measure which marketing ads convert into installs — *then* you'd re-add the key. Not now.)

## What to do (in your local Capacitor checkout, not this Lovable project)

The iOS native project lives in your local repo after `npx cap add ios`, so these steps happen on your Mac:

1. Open `ios/App/App/Info.plist` in Xcode.
2. Delete the `NSUserTrackingUsageDescription` entry.
3. Search the iOS project for `ATTrackingManager` or any tracking-related Capacitor plugin (e.g. `@capacitor-community/app-tracking-transparency`). If found and you're not using it, uninstall the plugin and run `cd ios/App && pod install`.
4. Rebuild and re-upload:
   ```
   npm run build
   npx cap sync ios
   ```
   then Archive in Xcode → upload to App Store Connect.
5. In App Store Connect → App Privacy, leave every data type's "Used for tracking" toggle **off**. Keep the Data Collection answers exactly as you already submitted.

### If you can't find the key

It was probably added by a plugin you experimented with. Paste the contents of your local `ios/App/App/Info.plist` and `ios/App/Podfile.lock` in a follow-up and I'll pinpoint which dependency to remove.

## Marketing on Meta/Google — no app changes needed

You can set up Meta Ads Manager and Google Ads campaigns whenever you want. They link to your App Store page or `https://app.finditonflea.com` and require zero changes to the Flea binary or privacy declarations.

Optional later: if you want to measure *which* Meta/Google ad caused each install (attribution), you'd integrate the Meta SDK or Google Ads SDK and **then** re-add the ATT key. Not required to start running ads.

## Deliverable in this Lovable project

Small doc update so future-you remembers the rule:

- Append an **ATT / Tracking** section to `docs/app-store-privacy-questionnaire.md`:
  - Current state: ATT key removed; nothing used for tracking.
  - Rule: marketing Flea on Meta/Google does NOT require ATT.
  - Re-enable checklist (re-add key, install ATT plugin, update App Privacy answers) only when adding in-app ads or install-attribution SDKs.

All native iOS work happens in your local checkout, not in this repo.

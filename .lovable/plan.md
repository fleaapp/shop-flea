# Ship Flea to Google Play

## Current state (verified this turn)

- No `android/` project exists. iOS is the only native target today.
- `capacitor.config.ts` already has Android splash/keyboard/status-bar settings, but no `SocialLogin` provider config block.
- `public/.well-known/assetlinks.json` (Android App Links) does not exist; only the iOS `apple-app-site-association` is present.
- `GOOGLE_ANDROID_CLIENT_ID` in `src/config/googleAuth.ts` is empty (falls back to the web client ID).
- `src/lib/googleSignIn.ts` `shouldUseNativeGoogle()` only returns true for iOS - Android falls through to the in-app browser flow.
- Push is iOS-only: `useNativePushNotifications.ts` early-returns when `getPlatform() !== 'ios'`, and `send-push-notification` only has APNs (iOS) + web-push paths - no FCM/Android path.
- `usePushNotifications.ts` (web VAPID) early-returns on any native platform, so Android currently gets NO push at all.
- Apple Pay and Apple Sign-In are already gated to iOS only.

## What you (the user) provide

1. A Google Play Console developer account.
2. An Android Studio install (with SDK + build tools) on your machine - the Lovable sandbox has no Android toolchain, so `cap add android`, the gradle build, and AAB signing all run locally, exactly like the iOS/Xcode flow.
3. A Firebase project (new or existing) with an Android app registered to package `com.finditonflea.app`. You'll download `google-services.json` and drop it at `android/app/google-services.json`. This single Firebase project serves both push (FCM) and Google Sign-In's Credential Manager.
4. An Android OAuth client ID in Google Cloud Console (you said you'll create it), authorised with the app signing key SHA-1. Paste it into the secure form when requested - it is a public client ID but I'll store it as a secret so you never retype it.

## Build

### 1. Capacitor config: add SocialLogin provider block

`capacitor.config.ts` - add a `plugins.SocialLogin` block enabling Google + Apple, disabling Facebook/Twitter. This is what the `@capgo/capacitor-social-login` plugin reads to bundle the Google Credential Manager dependency on Android.

### 2. Android native config file

New `android-native/` directory mirroring `ios-native/`, holding:
- `AndroidManifest.patch.json` - permissions (camera, internet, post_notifications), the app label, and the App Links + custom-scheme intent filters (autoVerify for `https://app.finditonflea.com`, plus `com.finditonflea.app`).
- `signing.properties.template` - keystore path/alias/passwords (gitignored; you fill in your real keystore).

### 3. Android App Links association file

New `public/.well-known/assetlinks.json` - the Digital Asset Links file Android fetches to auto-verify App Links. Contains the package `com.finditonflea.app` and a SHA-256 fingerprint slot. Because the fingerprint depends on your signing key, the setup script (step 4) will generate the correct fingerprint from your keystore and inject it; the committed file ships a clearly-marked placeholder so the route is live but does not auto-verify until the real fingerprint is filled.

### 4. Native patch script: `scripts/setup-android-native.sh`

A bash script (mirroring `setup-ios-native.sh`) run after `npx cap sync android`. It:
- Copies `google-services.json` into `android/app/` if present and fails loudly if missing (no FCM and no Google sign-in without it).
- Wires the Google Services gradle plugin: adds `classpath 'com.google.gms:google-services:4.4.2'` to `android/build.gradle` and `apply plugin: 'com.google.gms.google-services'` + the `firebase-messaging` dependency to `android/app/build.gradle` (idempotent - skips if already present).
- Applies the AndroidManifest patches (permissions, intent filters, app label) from `android-native/AndroidManifest.patch.json`.
- If a `signing.properties` file exists, writes a `signingConfigs` block into `android/app/build.gradle` so `./gradlew bundleRelease` produces a signed AAB.
- Generates the SHA-256 fingerprint of the configured keystore and injects it into `public/.well-known/assetlinks.json` (and the committed copy) so App Links auto-verify.
- Is idempotent: re-running after `cap sync` produces an identical result.

### 5. Archive-prep script: `scripts/prepare-android-archive.mjs` + npm script

Mirrors `prepare-ios-archive.mjs`:
- Asserts project root (`package.json` + `capacitor.config.ts`).
- Cleans `dist/`, runs `vite build` with build-id env vars.
- Runs `npx cap sync android`.
- Runs `bash scripts/setup-android-native.sh`.
- Asserts `android/app/google-services.json` exists.
- Asserts the Google sign-in control marker (`flea-google-auth-control`) is present in the copied Android web bundle, same check as iOS.
- Prints `SAFE TO ARCHIVE - Flea build <id> - <date>`.
- Adds `android:archive-ready` to `package.json` scripts.

### 6. Google Sign-In on Android

- `src/config/googleAuth.ts`: `GOOGLE_ANDROID_CLIENT_ID` will be read from a secret-backed env at build time, with the web client ID as the documented fallback (the user said they'll create the Android client ID).
- `src/lib/googleSignIn.ts`: extend `shouldUseNativeGoogle()` to also return true for `getPlatform() === 'android'`, and confirm the `SocialLogin.initialize` call passes `webClientId` (already uses `GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID`).
- `src/lib/authRedirects.ts`: confirm the deep-link handler already matches the custom scheme `com.finditonflea.app` (it does, per the iOS OAuth-return work) - no change needed, just verify.

### 7. Push notifications on Android (FCM)

- `src/hooks/useNativePushNotifications.ts`: remove the iOS-only guard. On Android, `requestPermissions` + `register` yields an FCM token via the same `@capacitor/push-notifications` plugin (which uses Firebase under the hood once `google-services.json` is present). Register the token with `platform: 'android'`. Keep the iOS path unchanged.
- `supabase/functions/send-push-notification/index.ts`: add an FCM send path for `sub.platform === 'android'`, alongside the existing APNs and web-push paths. Use the Firebase Admin SDK (FCM v1 HTTP API) with a service-account JSON stored as the secret `FCM_SERVICE_ACCOUNT_JSON`. Map the Flea notification payload (title/body/deeplink) to the FCM `notification` + `data` fields, and handle 410/unregistered tokens the same way as APNs.
- Secret: `FCM_SERVICE_ACCOUNT_JSON` (the Firebase service-account JSON you download from Firebase Console). I'll request it via the secure form once the Firebase project exists.

### 8. PLAYSTORE.md

New root doc with the end-to-end flow, mirroring `TESTFLIGHT.md`:

1. `git pull && npm install`
2. Create Android project once: `npx cap add android`
3. Drop `google-services.json` at `android/app/`
4. Create a keystore (`keytool -genkey ...`), fill `android-native/signing.properties` (gitignored)
5. Enrol in Play App Signing in Google Play Console
6. `npm run android:archive-ready` - wait for `SAFE TO ARCHIVE`
7. `npx cap open android` -> Build > Generate Signed Bundle > AAB
8. Upload AAB to Play Console (internal test -> production)
9. Verify the build label + Google button on device

## Verification

- `npm run android:archive-ready` prints `SAFE TO ARCHIVE` in the cloud sandbox (build + sync + marker assert; the `google-services.json`/keystore asserts are skipped in the sandbox since no android/ project exists there - they run locally).
- On a local machine with the Android SDK: `setup-android-native.sh` is idempotent (running twice yields identical `build.gradle` + manifest).
- An installed Android build shows the build label and a working Google button.
- A test push sent via the admin tool delivers to an Android device (FCM path).
- App Links auto-verify: `https://app.finditonflea.com/listing/<id>` opens in the app when installed.

## Out of scope

- Google Play Console listing copy, screenshots, content rating questionnaire, data-safety form - those are Play Console UI tasks, documented in PLAYSTORE.md but not automated.
- Apple Sign-In on Android (the plugin supports it via OAuth flow) - leaving iOS-only for now; can be added later.
- Android-specific Stripe payment method changes - Stripe PaymentSheet already supports Google Pay if enabled; that is a separate config task, not part of this shipping plan.

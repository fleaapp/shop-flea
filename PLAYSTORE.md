# Google Play Shipping Guide

This mirrors the iOS TestFlight flow. The Lovable sandbox has no Android
toolchain, so `cap add android`, the gradle build, and AAB signing all run on
your local machine - exactly like Xcode for iOS.

## One-time setup

### 1. Prerequisites

- Android Studio installed (with SDK + build tools) on your machine.
- A Google Play Console developer account (one-time $25 USD fee).
- A Firebase project (free) - used for BOTH push notifications (FCM) and
  Google Sign-In's Credential Manager.

### 2. Pull and install

```bash
git pull
npm install
```

### 3. Create the Android project (once)

```bash
npx cap add android
```

This generates the `android/` directory. Commit it to your repo (like `ios/`).

### 4. Firebase setup

1. Go to https://console.firebase.google.com and create (or open) a project.
2. Project settings > "Your apps" > Add an Android app.
   - Package name: `com.finditonflea.app`
   - App nickname: `Flea`
   - (Optional) SHA-1 of your signing key - add it now or later.
3. Download `google-services.json`.
4. Place it at `android/app/google-services.json` (or
   `android-native/google-services.json` - the setup script copies it in).

### 5. FCM service account (for server-side push)

The `send-push-notification` edge function needs a Firebase service account to
send FCM messages server-side:

1. Firebase Console > Project settings > Service accounts.
2. Click "Generate new private key" and download the JSON.
3. Save it as the secret `FCM_SERVICE_ACCOUNT_JSON` in your Lovable project
   (Settings > Secrets). Paste the entire JSON contents as the value.

### 6. Google Sign-In Android client ID

Google Sign-In on Android needs a client ID authorised with your app's signing
key SHA-1:

1. Generate your signing keystore (once):

   ```bash
   keytool -genkey -v -keystore flea-release.keystore -alias flea \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Get its SHA-1:

   ```bash
   keytool -list -v -keystore flea-release.keystore -alias flea | grep SHA1
   ```

3. Google Cloud Console > APIs & Services > Credentials > Create credentials >
   OAuth client ID > Android.
   - Package name: `com.finditonflea.app`
   - SHA-1: (from step 2)
4. Copy the resulting client ID. Save it as the secret
   `GOOGLE_OAUTH_CLIENT_ID` (or tell Lovable to wire it into
   `VITE_GOOGLE_ANDROID_CLIENT_ID`).
5. Fill in `android-native/signing.properties` (rename from the template):

   ```
   storeFile=/absolute/path/to/flea-release.keystore
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=flea
   keyPassword=YOUR_KEY_PASSWORD
   ```

   This file is gitignored - never commit real credentials.

### 7. Play App Signing

When you upload your first AAB, Google Play Console asks you to enrol in Play
App Signing. Say yes - Google keeps a separate signing key and re-signs your
builds. Your `flea-release.keystore` becomes the "upload key". This is standard
and required for new apps.

For Android App Links auto-verification, the `assetlinks.json` fingerprint must
match Google's app-signing key (not your upload key). After your first upload,
get the SHA-256 of the app signing key from Play Console (App signing >
 App signing key certificate) and replace the placeholder in
`public/.well-known/assetlinks.json`, then redeploy the web app.

## Build

### 8. Prepare the archive bundle

```bash
npm run android:archive-ready
```

This cleans `dist/`, builds, runs `npx cap sync android`, patches the native
project (`scripts/setup-android-native.sh`), and asserts the Google sign-in
marker is present. Wait for `SAFE TO ARCHIVE`.

### 9. Build the signed AAB

```bash
npx cap open android
```

In Android Studio:
- Build > Generate Signed Bundle / APK > Android App Bundle.
- Select your `flea-release.keystore` and enter the password.
- Select the `release` build variant.
- Finish. The `.aab` lands in `android/app/build/outputs/bundle/release/`.

## Upload

### 10. Create the app in Play Console

1. Play Console > Create app.
   - App name: Flea
   - Default language: English (Australia)
   - App or game: App
   - Free or paid: Free
2. Fill in the app details, store listing (description, screenshots, icon,
   feature graphic), and the content rating questionnaire.
3. Privacy Policy URL: https://app.finditonflea.com/privacy
4. Data safety form - declare the data you collect (see the app's privacy
   policy for the full list).

### 11. Upload the AAB

1. Play Console > Production (or Internal testing for your first upload) >
   Create new release.
2. Upload the `.aab`.
3. Review the release, then Save and review > Start rollout.

Internal testing is fastest for your first upload - it skips most of the
production review and lets you test on real devices within minutes.

### 12. Verify on device

- Install from the internal test track.
- Open the app, confirm the build label on the auth screen.
- Test Google Sign-In (the native account picker should appear).
- Send a test push from the admin tools and confirm it arrives.

## Subsequent updates

```bash
git pull
npm install
npm run android:archive-ready
npx cap open android   # Build > Generate Signed Bundle
```

Then upload the new AAB to Play Console as a new release.

## Troubleshooting

- **`google-services.json missing`**: run `scripts/setup-android-native.sh`
  after dropping the file, or place it directly in `android/app/`.
- **Google Sign-In shows a browser instead of the picker**: the
  `google-services` gradle plugin isn't applied. Re-run the setup script.
- **Push notifications don't arrive on Android**: confirm
  `FCM_SERVICE_ACCOUNT_JSON` is saved, and the device registered with
  `platform: 'android'` (check `push_subscriptions` in the database).
- **App Links don't open the app**: the `assetlinks.json` fingerprint must match
  Google's app signing key SHA-256, not your upload key. Get it from Play
  Console > App signing.
- **Build fails with signing error**: ensure `android-native/signing.properties`
  exists with correct keystore path/passwords.

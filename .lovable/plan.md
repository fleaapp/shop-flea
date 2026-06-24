## What we already fixed in code

The app now uses native iOS sign-in for both Google and Apple, so it should stay inside the app instead of opening Safari.

- `src/lib/googleSignIn.ts` — added native Google Sign-In wrapper.
- `src/lib/appleSignIn.ts` — already existed; now surfaces better error messages.
- `src/pages/Auth.tsx` — updated to use the native iOS paths first, falling back to web on Android/PWA.

You still need to do three pieces of configuration locally on your Mac / in Apple/Google portals before the next TestFlight build.

## Step 1: pull the latest code first

Before you run anything, make sure you have the latest code from the repository:

```bash
git pull origin main
```

Replace `main` with your actual branch name if you use a different one (e.g. `develop`).

## Step 2: update native iOS project files

After pulling the latest code, run these commands from your project folder:

```bash
npm install
npx cap sync ios
```

This installs the new Google sign-in plugin and copies it into the iOS project.

## Step 3: configure Google sign-in

1. Go to the Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Make sure your project is selected.
3. Click **Create credentials → OAuth client ID**.
4. Choose **iOS** as the application type.
5. Enter bundle ID: `com.finditonflea.app`
6. Click **Create**. Copy the long client ID that looks like `123456789012-abcdef123.apps.googleusercontent.com`.
7. Open the iOS project in Xcode:

```bash
npx cap open ios
```

8. In Xcode, open `App/App/Info.plist`.
9. Add a new key `GIDClientID` and paste your client ID as the value.
10. Also add a `CFBundleURLTypes` array so the app can receive the Google redirect:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
    </array>
  </dict>
</array>
<key>GIDClientID</key>
<string>YOUR_IOS_CLIENT_ID</string>
```

Replace `YOUR_IOS_CLIENT_ID` with the actual ID from step 6.

## Step 3: fix Apple sign-in

Most Apple sign-in failures are caused by the bundle ID not being allowed by the backend.

1. Open your backend:

<presentation-actions>
<presentation-open-backend>View Backend</presentation-open-backend>
</presentation-actions>

2. Go to **Authentication → Providers → Apple**.
3. Find the field called **Authorized Client IDs** (or similar) and add:
   - `com.finditonflea.app`
   - Your web Services ID if it is not already there (usually looks like `com.finditonflea.app.web` or `app.finditonflea`)
4. Save the provider settings.

Then in Xcode:

1. Select the top-level **App** project in the file navigator.
2. Select the **App** target.
3. Go to the **Signing & Capabilities** tab.
4. Click **+ Capability** and add **Sign in with Apple**.
5. Make sure your Apple Developer account has the bundle ID `com.finditonflea.app` with Sign in with Apple enabled at https://developer.apple.com/account/resources/identifiers/list

## Step 4: build and push to TestFlight

Run these commands in order from the project root:

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select your target device or **Any iOS Device (arm64)** for archiving.
2. Choose **Product → Archive** from the menu.
3. Once the archive is done, click **Distribute App**.
4. Choose **App Store Connect**, then **Upload**.
5. Follow the prompts and upload.
6. After processing in App Store Connect, add the build to your TestFlight group and test again.

## What to expect after the fix

- **Google button:** should show a native Google account picker inside the app and sign you in without leaving Flea.
- **Apple button:** should show the system Apple sign-in sheet and sign you in.

If Apple still fails after this, the next TestFlight run will now show a more detailed error message (like "Unacceptable audience in id_token"), which will tell us exactly what is still misconfigured.

## Note on TestFlight vs App Store

This is not a TestFlight-only issue. A real App Store build would behave the same way, so it is worth fixing before release.
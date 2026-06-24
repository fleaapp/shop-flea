## Why Google still opens Safari

The code is already correct — `Auth.tsx` calls `nativeGoogleSignIn()` on iOS, which uses the `@codetrix-studio/capacitor-google-auth` plugin to show Google's native account sheet. No code change is needed.

It's falling back to the Safari/web flow because the **iOS native side isn't configured yet**. The plugin needs a Google iOS OAuth client + URL scheme in your Xcode project. Until that's wired up, `GoogleAuth.signIn()` throws, and (depending on timing) the web `supabase.auth.signInWithOAuth` path kicks in, which opens Safari.

## What you need to do (one-time iOS setup)

### 1. Create an iOS OAuth client in Google Cloud Console
- Go to **Google Cloud Console → APIs & Services → Credentials**.
- Click **Create Credentials → OAuth client ID**.
- Application type: **iOS**.
- Bundle ID: `com.finditonflea.app`
- Click **Create**. You'll get an **iOS Client ID** that looks like `1234567890-abc123.apps.googleusercontent.com`.
- Copy it. Also note the **reversed** version (same string, dotted-reversed): `com.googleusercontent.apps.1234567890-abc123`.

### 2. Add that iOS Client ID to Supabase
- Supabase dashboard → **Authentication → Providers → Google**.
- In **Authorized Client IDs**, add the new iOS client ID (alongside your existing web one).
- Save.

### 3. Add the client ID + URL scheme to Xcode
In Xcode, open `ios/App/App/Info.plist` (right-click → Open As → Source Code) and add inside the top-level `<dict>`:

```xml
<key>GIDClientID</key>
<string>YOUR_IOS_CLIENT_ID.apps.googleusercontent.com</string>
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

(If `CFBundleURLTypes` already exists for Apple Sign-In or anything else, just add the extra `<dict>` entry inside the existing `<array>` — don't duplicate the key.)

### 4. Sync and rebuild
In Terminal:
```
npm run build
npx cap sync ios
npx cap open ios
```
Then in Xcode: **Product → Clean Build Folder**, then **Archive → Distribute → TestFlight**.

### 5. Test
On TestFlight, tap **Continue with Google** — it should now show the native iOS Google account sheet instead of bouncing to Safari.

---

**No code changes are needed in this project.** This is purely Google Cloud + Supabase + Xcode configuration. Approve this plan and I'll be on standby if anything in steps 1–5 throws an error.
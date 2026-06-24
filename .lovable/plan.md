## Short answer

No — this isn't a TestFlight quirk. A TestFlight build behaves exactly like the App Store release, so both issues will persist in production unless we fix them.

- **Google bounced to Safari** because `handleGoogleSignIn` calls `supabase.auth.signInWithOAuth({ provider: 'google' })` directly. On native iOS that triggers a full-page redirect, which Capacitor hands off to Safari. The redirect back to `https://app.finditonflea.com` then opens the web app, not your installed app — so the user never gets a session inside Flea.
- **Apple failed** even though `nativeAppleSignIn` runs the system sheet. The most likely cause is that the Supabase Apple provider isn't configured to accept the iOS bundle ID (`com.finditonflea.app`) as a valid `client_id` / audience for the identity token, or the Services ID / nonce setup is wrong. Without that, `signInWithIdToken` rejects the token Apple returns.

## What to build

### 1. Native Google Sign-In (in-app, no Safari)

Use the native Google credential flow to get an ID token, then exchange it with Supabase — same pattern Apple already uses.

- Add `@capacitor-community/google-sign-in` (or `@codetrix-studio/capacitor-google-auth`).
- Create `src/lib/googleSignIn.ts` mirroring `appleSignIn.ts`:
  - `isIosNative()` guard, returns `{ handled: false }` on web so we fall back to existing redirect flow.
  - Call the plugin's `signIn()` → receive `idToken`.
  - `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce })`.
- Update `handleGoogleSignIn` in `src/pages/Auth.tsx` to try `nativeGoogleSignIn()` first, fall back to `supabase.auth.signInWithOAuth` on web/Android.
- iOS config:
  - Add the iOS OAuth client ID from Google Cloud Console.
  - Register the reversed client ID as a URL scheme in `ios/App/App/Info.plist`.
  - Add `GIDClientID` to `Info.plist`.

### 2. Fix native Apple Sign-In

Investigate why the existing `nativeAppleSignIn` call fails. Likely fixes, in order:

- Confirm the Supabase Apple provider has `com.finditonflea.app` listed as an additional allowed client ID (alongside the web Services ID). Without it, the identity token's `aud` claim is rejected.
- Confirm "Sign in with Apple" capability is enabled on the iOS app target in Xcode and provisioned in the Apple Developer portal for that bundle ID.
- Verify the nonce flow: `appleSignIn.ts` already hashes correctly (SHA-256 hex of raw nonce sent to Apple, raw nonce sent to Supabase) — keep as is.
- Add better error surfacing: log `error.message` and `error.status` from `signInWithIdToken` to a toast in dev so we can see the real Supabase rejection reason in the next TestFlight run.

### 3. Verification

- Rebuild, `npx cap sync ios`, push to TestFlight.
- Google button: stays inside the app, shows the native Google account picker sheet, returns to Flea signed in.
- Apple button: shows the system Apple sheet, returns to Flea signed in.

## Technical notes

- Keep the web/PWA flows unchanged — only native iOS gets the new code path.
- The `flea_oauth_signup` localStorage flag and `resolve-oauth-conflict` post-sign-in guard in `AuthContext` already work for `signInWithIdToken` sessions, so the duplicate-account dialog still functions.
- Do not switch to `lovable.auth.signInWithOAuth` — this app uses the external Supabase project, and that helper sets the session on the wrong client (already noted in the existing code comment).
- No DB/schema changes needed.

## Out of scope

- Android native Google sign-in (can be a follow-up; Android isn't on TestFlight).
- Changing the web OAuth flow on desktop/PWA.

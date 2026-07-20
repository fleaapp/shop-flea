## Why native Apple Sign-In stopped working

Before the Cloud migration, Apple Sign-In was configured on the old (external) Supabase project as **BYOC (Bring Your Own Credentials)**, with your iOS bundle ID `com.finditonflea.app` registered as an accepted `client_id` on the Apple provider. That is why the native sheet worked: the identity token it returns has `aud = com.finditonflea.app`, and Supabase accepted it.

After migrating to Lovable Cloud, Apple was re-enabled using **managed Apple** (the "Use Lovable's credentials" path). Managed Apple is configured with Lovable's own Services ID as the accepted `client_id` — it does not include your iOS bundle ID as an accepted audience. So the native sheet still gets a valid token from Apple, but Cloud's Apple provider rejects it (`missing OAuth secret` / audience mismatch), which is why sign-in only started failing after the cutover.

Managed Apple currently has no knob to add an additional accepted audience, so the fix is to restore the same BYOC setup you had before, this time on Cloud.

## Plan: restore BYOC Apple Sign-In on Cloud (native-only)

### 1. Reuse or recreate Apple credentials
Since this worked before, the Apple Developer artefacts likely still exist. Confirm or regenerate:
- **App ID** `com.finditonflea.app` with "Sign In with Apple" capability enabled (this is the audience the native sheet uses).
- **Sign In with Apple key** (.p8). If you still have the old .p8, reuse it. If not, create a new one and note the **Key ID**.
- **Team ID** (10-char, top-right of Apple Developer console).

Because you're native-only now, you do **not** need a Services ID or any web return URL configured on Apple's side.

### 2. Configure BYOC Apple in Cloud
In the Cloud backend → Users → Auth Settings → Sign In Methods → Apple:
- Switch from "Use Lovable's credentials" to "Use your own credentials".
- **Client ID:** `com.finditonflea.app` (bundle ID, not a Services ID).
- **Client Secret:** generate the JWT in the same panel using Team ID, Key ID, Client ID = `com.finditonflea.app`, and the .p8 contents. Valid 6 months — set a calendar reminder to regenerate.

<presentation-actions><presentation-open-backend>View Backend</presentation-open-backend></presentation-actions>

### 3. Strip the now-dead web fallback in `src/pages/Auth.tsx`
`handleAppleSignIn` currently branches to `lovable.auth.signInWithOAuth('apple', ...)` for web/PWA. Since you ship native-only and BYOC Apple isn't wired up for a web return URL, that branch will only ever produce confusing errors. Replace it with a short toast telling non-native users Apple Sign-In is only available in the iOS app, and keep the existing `nativeAppleSignIn()` path untouched for iOS.

### 4. Verify
After you save the BYOC config, do a native build and sign in with Apple. The existing `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })` call in `src/lib/appleSignIn.ts` will succeed because the token's `aud` now matches the configured `client_id`. No code changes are needed in `appleSignIn.ts`.

### What I will do vs. what only you can do
- **You:** steps 1 and 2 in the Apple Developer console and the Cloud backend UI — I can't create Apple keys or edit provider secrets for you.
- **Me (after you approve):** step 3 (trim the web branch in `Auth.tsx`) so users on non-native surfaces get a clear message instead of a raw error.

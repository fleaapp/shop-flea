# Google sign-in with Flea branding (stays in-app)

Goal: users tap "Continue with Google", see **Flea** on the Google consent screen, and never leave the app.

## Approach

Use your own Google Cloud OAuth client (so Google shows Flea, not Lovable) with the
**in-app browser** flow (SFSafariViewController on iOS / Chrome Custom Tab on Android,
already used for Apple and Stripe via `openInAppUrl`). Google explicitly allows
SFSafariViewController — it blocks only embedded WKWebViews — so this is the compliant
"stays in app" path and needs **no** native Google plugin and **no** URL scheme in
Info.plist (which is what got the archive rejected before).

## What you paste where

### 1. In Google Cloud Console → Credentials → your **Web application** OAuth client

Authorised JavaScript origins:

```text
https://app.finditonflea.com
https://shop-flea.lovable.app
```

Authorised redirect URIs (this exact one is required — it is the backend auth callback):

```text
https://teaicrimlqdayqpmxasc.supabase.co/auth/v1/callback
```

Then copy the **Client ID** and **Client secret** from that same screen.

### 2. In the app backend auth settings

Open Cloud → Users → Auth Settings → Sign-in methods → Google, switch it to your own
credentials, and paste the Client ID and Client secret from step 1. Save.

The redirect URL field in that screen is managed automatically by Lovable Cloud, so it
may be read-only or hidden — that is normal. The only redirect URI you need to control
is the one in Google Cloud Console (step 1), and it must match the backend callback
above.

### 3. Verify the configured callback (no manual allow-list needed)

You do not need to add `https://app.finditonflea.com/**` or `https://shop-flea.lovable.app/**`
manually. Lovable Cloud includes the project's origins in the managed OAuth allow-list
automatically. Just confirm the auth settings screen shows the callback:

```text
https://teaicrimlqdayqpmxasc.supabase.co/auth/v1/callback
```

If it shows a different URL, copy that exact value and paste it into Google Cloud Console
instead.

## Code changes

- `src/pages/Auth.tsx` — restore the "Continue with Google" button on both the login and
  signup tabs, styled to match the existing Apple button. `handleGoogleSignIn` already
  exists and already falls through to the web OAuth path; keep `prompt: 'select_account'`
  per the existing preference.
- `src/lib/googleSignIn.ts` — leave `nativeGoogleSignIn` returning `{ handled: false }`
  so every platform uses the in-app browser path. Update the stale "paused" comment to
  explain the deliberate SFSafariViewController choice.
- Confirm the OAuth return lands back in the app: `getSignupRedirectUrl()` must resolve to
  the universal-link origin (`https://app.finditonflea.com`) on native so the in-app browser
  hands the session back and closes, matching the existing Apple flow.
- Provider-conflict handling (`ProviderConflictDialog`, `check-email-provider`) already
  covers Google; no change needed.

## Notes

- Your Google Cloud consent screen branding (app name, logo, domain) is what users see —
  nothing from Lovable appears.
- If the consent screen is still in "Testing", only your added test users can sign in;
  publish it to production when you are ready.
- No Xcode change, no Google plugin, no `[REVERSED_IOS_CLIENT_ID]` placeholder, so the
  previous App Store rejection cause does not return.

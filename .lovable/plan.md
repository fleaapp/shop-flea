## Goal
Re-enable Google sign-in / signup on iOS (and everywhere else) without ever kicking the user out to Safari. The OAuth handshake runs inside an in-app browser sheet (SFSafariViewController / Chrome Custom Tab), just like the Stripe dashboard bridge, then returns to the app via the existing universal link.

## How it will work

```text
[Auth screen]
   ↓ tap Google
supabase.auth.signInWithOAuth({ provider:'google', skipBrowserRedirect:true,
                                redirectTo: https://app.finditonflea.com/auth/callback })
   ↓ returns { url }
openInAppUrl(url)  →  SFSafariViewController opens in-app
   ↓ user picks Google account, consents
Google → https://app.finditonflea.com/auth/callback?code=...
   ↓ Universal Link (AASA already published, Team ID MAYU87849K)
NativeDeepLinkHandler in App.tsx
   ↓ Browser.close() + navigate to /auth/callback
AuthCallback.tsx calls completeAuthSessionFromUrl() → session set → routed home
```

No Safari, no external browser. The same code path also works on web (the sheet just becomes a same-tab navigation, which is the existing Stripe pattern).

## Changes

1. `src/lib/googleSignIn.ts`
   - Remove the hard iOS block. Keep the file (still used to detect runtime) but drop the "fail closed on iOS" behavior — the in-app browser is now the sanctioned path.

2. `src/pages/Auth.tsx`
   - Delete the iOS-hide logic (`hideGoogleOnIos`, the `flea-ios-google-web-oauth-blocked` listener, and the two "cannot stay inside the iPhone app" toasts).
   - Replace `handleGoogleSignIn` with:
     - Call `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: getSignupRedirectUrl(), skipBrowserRedirect:true, queryParams:{ prompt:'select_account' } } })`.
     - Pass the returned `data.url` to `openInAppUrl(url)` so native platforms open SFSafariViewController and web falls back to same-tab (unchanged behavior for web).
     - Toast on error only; no platform gating.
   - The Google button is always rendered.

3. `src/App.tsx` / `NativeDeepLinkHandler`
   - Verify (no change expected) that when the universal link fires, it calls `Browser.close()` before navigating to `/auth/callback`. If missing, add the `Browser.close()` call so the SFSafariViewController dismisses automatically after Google redirects back.

4. `src/pages/AuthCallback.tsx`
   - No functional change required; already handles `code=` exchange via `completeAuthSessionFromUrl`.

## Out of scope
- No changes to Apple sign-in, email flow, AASA file, Team ID, or entitlements.
- No new secrets. Google OAuth continues to use the Lovable Cloud managed credentials.
- No changes to `openInAppUrl.ts` — its existing native/web split is exactly what's needed.

## Verification
- iOS (native): tapping Google opens an in-app Safari sheet, user picks account, sheet closes automatically, user lands signed in on the home feed.
- Web: unchanged — same-tab redirect to Google and back.
- Existing account with different provider still triggers the `ProviderConflictDialog` (that logic lives in `AuthContext` and isn't touched).
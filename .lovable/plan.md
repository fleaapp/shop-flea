## Plan

I’ll fix the signup/reset email redirect so native app signups no longer rely on `window.location.origin`, which can become `capacitor://localhost` inside the iOS app and cause the auth backend to reject or skip the verification email.

## Changes

1. **Use a fixed HTTPS callback for auth emails**
   - Signup verification will redirect to:
     ```text
     https://app.finditonflea.com/auth/callback
     ```
   - Password reset will continue to route to the reset screen, but using the same native-safe domain instead of the Capacitor origin.

2. **Add an auth callback screen**
   - Add `/auth/callback` to finish email verification and send the user into the app.

3. **Handle native app links**
   - Add Capacitor deep-link handling so when iOS opens `https://app.finditonflea.com/auth/callback`, the native app routes internally instead of leaving the user in Safari.

4. **Add Universal Links support file**
   - Add the Apple association file at:
     ```text
     public/.well-known/apple-app-site-association
     ```
   - This enables `app.finditonflea.com` links to open the installed iOS app.

## What you’ll still need to do outside Lovable

1. Add this redirect URL to the external auth backend allowlist:
   ```text
   https://app.finditonflea.com/auth/callback
   ```
2. In Xcode, add Associated Domains:
   ```text
   applinks:app.finditonflea.com
   ```
3. Replace the Apple Team ID placeholder in the association file with your real Apple Developer Team ID.
4. Pull the project locally, then run:
   ```text
   npx cap sync ios
   ```
5. Rebuild/reinstall the native app.

This should restore verification emails for native signup and make the email link open back into the app.
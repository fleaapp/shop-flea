## Enable managed Apple Sign In

You picked the managed path, so no Apple Developer configuration is needed. Close the Apple Developer tab — nothing to paste there.

### What I'll do

1. Call `supabase--configure_social_auth` with `providers: ["apple"]` to enable Lovable Cloud managed Apple Sign In.
2. Verify the existing sign-in UI calls `lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin })`. If the Apple button is currently hidden/commented out (same as Google was), re-enable it.

### What you'll do

- Test "Sign in with Apple" on the preview and on the native iOS build.
- If it fails on native iOS, tell me and I'll add the `@capacitor-community/apple-sign-in` native bridge (managed cloud handles the web flow out of the box; iOS native uses Apple's system sheet).

### Notes

- Managed Apple works on both `shop-flea.lovable.app` and `app.finditonflea.com` automatically.
- No `.p8` key, Services ID, Team ID, or return URLs to configure.

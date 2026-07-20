## Root cause

The web Apple button calls `supabase.auth.signInWithOAuth({ provider: 'apple' })` directly. That routes to GoTrue's `/authorize?provider=apple`, which requires a BYOC Apple client secret to be stored on the provider. Managed Apple Sign In on Lovable Cloud is not exposed through that path — it is exposed through the `lovable.auth.signInWithOAuth` helper. GoTrue therefore returns `validation_failed: Unsupported provider: missing OAuth secret`.

Native iOS Apple (via `nativeAppleSignIn` → `signInWithIdToken`) is a different path and isn't affected by this error — the screenshot came from the web/PWA fallback.

## Fix

In `src/pages/Auth.tsx` → `handleAppleSignIn`, replace the web-fallback branch so it uses the Lovable managed helper instead of the raw Supabase call:

```ts
import { lovable } from '@/integrations/lovable';

// Web / PWA / Android fallback:
const result = await lovable.auth.signInWithOAuth('apple', {
  redirect_uri: window.location.origin,
});
if (result.error) {
  localStorage.removeItem('flea_oauth_signup');
  console.error('Apple sign-in error:', result.error);
  toast.error('Apple sign-in failed. Please try again.');
  return;
}
if (result.redirected) return; // browser is redirecting to Apple
```

Leave the iOS native branch (`nativeAppleSignIn`) untouched — that path is correct.

## Verify

Reload the preview, tap Apple on the web sign-in screen, and confirm the flow redirects to Apple instead of showing the raw JSON error.

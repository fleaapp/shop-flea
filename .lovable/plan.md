# Fix Google "redirect_uri_mismatch"

## Why it still fails

Your screenshots show the three URIs Lovable's managed broker uses:

```text
https://oauth.lovable.app/callback
https://shop-flea.lovable.app/~oauth/callback
https://app.finditonflea.com/~oauth/callback
```

Those are correct - for the broker. But we changed the Google button to call the app's own
auth endpoint directly (to remove the "lovable" address from the sheet). That path does not
use any of those URIs. It uses the backend auth callback instead:

```text
https://teaicrimlqdayqpmxasc.supabase.co/auth/v1/callback
```

That one is not in the Google client's list, so Google rejects it before the account picker.

## Two ways forward - pick one

### Option A - keep the current direct flow (no "lovable" text anywhere)

Add one more entry in Google Cloud Console -> Credentials -> your Web OAuth client ->
Authorised redirect URIs, keeping the existing three:

```text
https://teaicrimlqdayqpmxasc.supabase.co/auth/v1/callback
```

Save, wait a few minutes, retry. No code change needed.

### Option B - go back to the managed broker (works right now, no console change)

I switch the Google button back to the managed OAuth helper, which uses the three URIs you
already have listed. Trade-off: the in-app sheet briefly shows the `oauth.lovable.app`
address before Google loads. The Google consent screen itself still shows Flea branding.

## Small code change either way

Add a friendlier failure message on the auth screen so a Google configuration error reads
"Google sign-in isn't available right now - try Apple or email" instead of leaving the user
on Google's raw error page.

## Technical notes

- Option B touches `src/pages/Auth.tsx` and `src/lib/oauthPopup.ts`.
- Error-message tweak touches `src/pages/Auth.tsx` only.
- No database or edge function changes.

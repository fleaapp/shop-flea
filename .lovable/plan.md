# Remove the leftover iOS Google block

## What's happening

The error is not coming from Google - it's our own code. Two old safety guards from
the earlier "Google must never open Safari on iOS" approach are still in place:

- `src/lib/supabase.ts` wraps `signInWithOAuth` and hard-fails any Google sign-in when
  the runtime looks like iOS, returning exactly the message in your screenshot.
- `src/lib/iosGoogleSafariGuard.ts` (installed in `src/main.tsx`) also blocks any
  navigation or `window.open` to a Google authorize URL on iOS.

Their iOS detection matches the user agent, so it fires on iPhone Safari, the PWA, and
the Capacitor build alike.

**So yes - it will happen on native iOS too, and for the same reason.** The guards
predate the current in-app OAuth flow (`src/lib/oauthPopup.ts`), which already keeps the
user in-app via an SFSafariViewController sheet on native and a popup on web. They now
only block the working flow.

## Fix

1. Remove the `signInWithOAuth` Google/iOS override in `src/lib/supabase.ts` so the
   client passes the call straight through.
2. Stop installing the Safari guard: remove the `installIosGoogleSafariGuard()` call and
   import from `src/main.tsx`, and delete `src/lib/iosGoogleSafariGuard.ts`.
3. Leave `src/lib/oauthPopup.ts` and `src/pages/Auth.tsx` as they are - the native path
   already uses `Browser.open({ presentationStyle: 'popover' })`, so Google opens as an
   in-app sheet, not Safari.

## Note

`src/integrations/supabase/client.ts` carries the same block but is an auto-generated
file; the app's auth calls go through `src/lib/supabase.ts`, so removing it there is what
unblocks sign-in. I'll confirm nothing in the auth path imports the generated client for
OAuth before finishing.

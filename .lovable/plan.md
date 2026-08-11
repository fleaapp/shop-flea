# Fix Google sign-in finishing inside the browser sheet (simplest version)

## Why the sheet keeps the session

iOS ignores universal links that are reached through a **server redirect**, and
OAuth return is exactly that (`Google -> auth service -> https://app.finditonflea.com/auth/callback`).
So the sheet keeps the page and loads the website - that is the screenshot.

There is no config-only workaround: the sheet cannot hand a session back to the
app over https, and the app cannot read the sheet's session (separate storage).
The standard - and shortest - fix is a custom app URL scheme, which iOS *does*
honour from a redirect. It is three small changes.

## The three changes

1. Register the scheme `com.finditonflea.app` in the existing iOS Info.plist patch
   (a real, hand-written scheme - not the placeholder that caused the earlier
   archive rejection).
2. Native sign-in returns to `com.finditonflea.app://auth/callback` instead of the
   https URL. iOS closes the sheet and delivers it straight to the app.
3. The existing deep-link handler accepts that URL and routes it to the in-app
   `/auth/callback`, which applies the session exactly as it does today.

Plus one backend setting: allow `com.finditonflea.app://auth/callback` in the auth
redirect allow-list, otherwise the auth service refuses the redirect.

Everything else stays as it is - the https universal link remains as a fallback,
and the session-recheck safety net stays.

## Technical notes

- `ios-native/Info.plist.patch.json`: add `CFBundleURLTypes` (extend
  `scripts/setup-ios-native.sh` if it does not yet apply dict-array patches).
- `src/lib/oauthPopup.ts`: native `redirectTo` -> `com.finditonflea.app://auth/callback`.
- `src/lib/authRedirects.ts`: `getRouteFromNativeAuthUrl` also matches the custom
  scheme.
- No database or edge function changes. Needs a new TestFlight build
  (`npm run ios:archive-ready`, then Clean Build Folder -> Archive).

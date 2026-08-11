# Fix Google sign-in finishing inside the browser sheet

## What is actually happening

The screenshot shows the real web app running **inside** the in-app browser sheet
(the `app.finditonflea.com` address bar is visible at the top) - it even started
the "Introduce yourself!" profile step there, not in the app.

Reason: iOS only hands a universal link to the app when the navigation is a user
tap or an in-page navigation. It deliberately ignores universal links reached via
a **server redirect**, which is exactly how OAuth returns
(`Google -> auth service -> https://app.finditonflea.com/auth/callback` is a 302
chain). So no matter which path we claim in the association file, the sheet keeps
the page and loads the website.

## Fix: return via a custom app URL scheme

Custom URL schemes are honoured from redirects inside the browser sheet, which is
the standard OAuth-for-native pattern.

1. Register the scheme `com.finditonflea.app` on iOS (`CFBundleURLTypes`), added
   to the existing Info.plist patch so it survives every `cap sync`. This is a
   real, hand-written scheme - not the placeholder reversed-client-id that caused
   the earlier archive rejection.
2. Native sign-in asks the auth service to return to
   `com.finditonflea.app://auth/callback` instead of the https URL. iOS closes the
   sheet and delivers the URL straight to the app.
3. Allow that URL in the backend auth redirect allow-list, otherwise the auth
   service refuses to redirect to it.
4. Teach the deep-link handler to accept the custom-scheme URL as well as the
   https one, mapping it to the in-app `/auth/callback` route with the tokens
   intact, then apply the session as it already does.
5. Keep the existing https universal-link path as a fallback, and keep the
   session-recheck safety net so a stalled sheet still resolves.

## Also: web pages should not run inside the sheet

As a belt-and-braces guard, when `/auth/callback` loads on the website and the URL
carries OAuth tokens from a native attempt, it should bounce itself to
`com.finditonflea.app://auth/callback` with the same tokens rather than continuing
into the web app. That prevents the "signing up on the website in the popup"
behaviour even if a redirect slips through.

## Technical notes

- `ios-native/Info.plist.patch.json`: add `CFBundleURLTypes` with scheme
  `com.finditonflea.app`; confirm `scripts/setup-ios-native.sh` applies array/dict
  patches (extend it if it only handles the current key types).
- `src/lib/oauthPopup.ts`: native `redirectTo` becomes
  `com.finditonflea.app://auth/callback`.
- `src/lib/authRedirects.ts`: `getRouteFromNativeAuthUrl` handles the custom
  scheme (no host match) in addition to `app.finditonflea.com`.
- `src/pages/AuthCallback.tsx`: on web, if tokens are present and a
  `native=1` marker is on the URL, redirect to the app scheme instead of
  completing the session.
- Backend: add `com.finditonflea.app://auth/callback` to the auth redirect
  allow-list. No database or edge function changes.
- Requires a new TestFlight build (`npm run ios:archive-ready`, then Clean Build
  Folder -> Archive). The web app must be published again for the fallback guard.

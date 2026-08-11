# Fix Google sign-in stalling on native iOS

## What is actually happening

The in-app browser sheet is being sent back to the wrong address after Google
approves the sign-in.

- Native sign-in asks the auth service to return the user to
  `https://app.finditonflea.com` (the bare home address).
- The iOS "open the app instead of the browser" file
  (`public/.well-known/apple-app-site-association`) only claims two addresses:
  `/auth/callback` and `/reset-password`.
- Because the home address is not claimed, iOS keeps the user inside the
  browser sheet, loads the website there, and the app never receives the
  session. That is the blank sheet in the screenshot.

The session is created successfully - it just lands in the browser sheet
instead of in the app.

## Fix

1. Send native OAuth back to the claimed address: use
   `https://app.finditonflea.com/auth/callback` as the native return URL
   instead of the bare origin. iOS then hands control straight to the app,
   the existing `appUrlOpen` handler closes the sheet and applies the session.
2. Also claim the home path in the association file (`/` and `/auth/*`) so any
   provider that strips the path still returns into the app rather than the
   browser.
3. Add a safety net in the native path: after the sheet opens, listen for the
   sheet being finished/dismissed and re-check for a session; if a session
   exists, close the sheet and continue into the app. This covers the case
   where the universal link does not fire at all.
4. Add a visible failure state: if the sheet is dismissed with no session,
   show "Sign in was not completed" instead of leaving the button spinning.

## About the missing account picker

The sheet is Safari-based, so Google shows the account chooser only when the
device's Safari already has a Google session; otherwise it shows manual entry.
`prompt=select_account` is already sent, which is the correct request. Once the
return-URL fix lands, manual entry will complete normally and log the user in.

If you want a guaranteed native account picker (the iOS system Google sheet),
that requires the native Google Sign-In SDK, which is what previously caused the
App Store archive rejection via the injected URL scheme. Not included here -
tell me if you want it as a follow-up and I will do it with a hand-written,
non-placeholder URL scheme.

## Technical notes

- `src/lib/oauthPopup.ts`: native `redirectTo` becomes
  `${NATIVE_ORIGIN}/auth/callback`; add `Browser.addListener('browserFinished')`
  session re-check and dismissal error result.
- `public/.well-known/apple-app-site-association`: add `/` and `/auth/*` paths.
- `src/pages/Auth.tsx`: surface the not-completed error and clear the loading
  state.
- No database or edge function changes. Requires a new TestFlight build
  (`npm run ios:archive-ready`, then Clean Build Folder -> Archive), and the
  updated association file must be published to the live web app before the
  device build is tested.

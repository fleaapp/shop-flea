# Fix signup deadlock + remove "Lovable" from Google sign-in

## 1. Walkthrough opening on top of the password dialog (screen freeze)

What's happening now: the signup steps are triggered from two different places. When the username step finishes, the code decides between "show password dialog" and "open walkthrough" by reading a browser flag (`flea_oauth_signup`). A separate effect can also lock the password dialog open based on the account's Google identity. If the flag was already cleared, the username step opens the walkthrough while that second effect simultaneously opens the password dialog - both render, each blocks the other's taps, and the screen appears frozen (exactly the screenshot).

Fix - one ordered state machine, no direct walkthrough calls:

- Add a single derived `signupStage` in `src/pages/Index.tsx`: `username` -> `password` (OAuth accounts only) -> `walkthrough` -> `welcome alert`.
- Decide "does this account still need a password" from the account identity + profile only (not the localStorage flag), so both code paths agree on one answer.
- Remove the `openCarousel()` calls from the username step and the password step. The walkthrough opens from a single effect that only runs when `signupStage === 'walkthrough'`.
- Hard guard in `src/components/AuthenticatedProviders.tsx`: never render `OnboardingCarousel` or `OnboardingOverlay` while a signup dialog is open, so even a stray trigger cannot overlap.
- Keep the welcome alert/toast gated on `walkthroughDone` as it is today.

Result: Google/Apple signup always runs username -> password -> walkthrough -> welcome, one screen at a time.

## 2. "Lovable" showing during Google sign-in

The sign-in currently opens Lovable's shared OAuth broker (`oauth.lovable.app`), so the in-app browser/popup shows that address and name while Google loads. Your Google consent screen branding is already Flea - it's only this intermediate hop that shows Lovable.

Plan:

- Switch the Google button to go straight to the app's own auth endpoint instead of the Lovable broker, using the Flea Google OAuth client you already set up in Google Cloud (client ID + secret entered once in the backend auth settings). The intermediate page then belongs to the app's auth domain, not Lovable.
- Keep the current in-app presentation: popover sheet on iOS native, popup on web, redirect fallback if blocked.
- Add a branded full-screen "Connecting to Google" overlay with the Flea logo behind the sheet, so any brief loading hop is covered by Flea branding.

Note: the address bar text in an iOS in-app browser sheet is controlled by iOS and always shows the current domain - with this change it shows the app's auth domain instead of `oauth.lovable.app`.

## Technical notes

- Files: `src/pages/Index.tsx`, `src/context/OnboardingContext.tsx`, `src/components/AuthenticatedProviders.tsx`, `src/lib/oauthPopup.ts`, `src/pages/Auth.tsx`.
- No database changes.
- To complete step 2 I need your Flea Google OAuth client ID and secret stored in the backend auth settings; without them the flow stays on the Lovable-managed credentials (and the Lovable hop).

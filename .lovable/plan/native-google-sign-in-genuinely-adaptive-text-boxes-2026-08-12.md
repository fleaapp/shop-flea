# Native Google sign-in + genuinely adaptive text boxes

## 1. Google sign-in: use the real native account picker

Today Google sign-in opens an in-app browser sheet (SFSafariViewController) pointed at Google's
web sign-in page. That is why you get a plain web form with a normal keyboard instead of the
familiar "Choose an account" sheet, why it is slow (a full web page load plus a redirect bounce
back into the app), and why it sometimes returns to the app having done nothing (the sheet closes
before the session lands).

Since the iOS OAuth client ID already exists in Google Cloud, we switch native iOS/Android to the
real native Google sign-in. **This includes iOS** - Google ships an official iOS SDK and the
account chooser is the same system sheet iPhone users see in Gmail, YouTube and other apps:

- Add the native Google Sign-In plugin and initialise it with the iOS client ID plus the existing
  web client ID (the web client ID is what mints the ID token the backend trusts).
- On iPhone, tapping "Continue with Google" opens the native Google account sheet - one tap on an
  existing account, no typing, no browser, no redirect. Android gets the same via its own picker.
- The returned ID token is exchanged for a session directly with the backend
  (`signInWithIdToken`), so there is no callback page, no bounce URL and no polling window.
  This removes the whole class of "came back and nothing happened" failures.
- Web and PWA keep the current popup flow unchanged.
- The in-app browser flow stays as an automatic fallback if the native sheet is unavailable, so a
  device that cannot use it still signs in.

**Branding:** the native Google sheet is Google's own UI (the Google logo plus the app name and icon
from the Google Cloud OAuth consent screen you already configured with Flea branding). It never
shows "Lovable" - that text only appeared because the old flow routed through the Lovable OAuth
broker. We now go direct to Google with your own credentials, so the sheet says Flea.

**On App Review:** this is the flow Apple expects for Google sign-in, and it does not affect the
Sign in with Apple requirement (Apple sign-in is already implemented, which is what Apple checks).
The previous archive rejection was caused by the plugin writing a placeholder
`REVERSED_IOS_CLIENT_ID` URL scheme into Info.plist on `cap sync`. The existing native patch script
will be extended to write the real reversed client ID every sync, so that cannot recur, and the
archive script will fail loudly if a placeholder is ever found in Info.plist.

## 2. Text boxes that move out of the keyboard's way

Behaviour you want, and what will be built: when you tap a field, the whole form slides up just far
enough that the field you are typing in **and the next field or button under it** sit above the
keyboard - exactly like a normal app. No scrollbars appear, nothing becomes scrollable, and you
never have to close the keyboard to reach the thing below.

Why it fails today: the current code lifts the surface only by the amount the focused field itself
is covered, then clamps that lift so the surface never passes the top of the screen. On a tall
signup dialog the clamp wins, so it barely moves and the field below stays hidden.

The change:

- Lift by enough to clear the focused field **plus** whatever comes immediately after it (the next
  input, or the primary button if the focused field is the last one), not just the focused field.
- Drive the lift from the live keyboard height the OS reports as it animates, so the form moves with
  the keyboard rather than after it - no lag, no race, no missed lift.
- Allow the lift to go as far as it needs; only clamp at the point where the top of the form would
  leave the screen. In the rare case where a form is genuinely taller than the space left, and only
  then, the form's body becomes scrollable as a last resort so nothing is unreachable.
- Purely a movement: no padding, no spacer, no footer strip, no coloured band. The form slides on
  the same background it already sits on, and slides straight back the moment the keyboard closes,
  so nothing looks different from today when no field is focused.



This is applied once at the shared dialog / drawer / sheet level, so it covers the username and
last name step, the password step, seller onboarding and every other form app-wide.


## Technical scope

- `package.json`, `scripts/patch-native-capacitor-packages.mjs`, `scripts/prepare-ios-archive.mjs`,
  `capacitor.config.ts` - native Google plugin plus URL scheme hardening.
- `src/lib/googleSignIn.ts` - real native implementation returning an ID token.
- `src/pages/Auth.tsx`, `src/lib/oauthPopup.ts` - native path first, browser sheet as fallback.
- `src/index.css`, `src/components/ui/dialog.tsx`, `drawer.tsx`, `sheet.tsx`,
  `src/lib/keyboardAware.ts` - CSS-variable driven keyboard fit and internal scrolling.

No database or edge function changes. The iOS client ID is not a secret and lives in config.

## What you need to do

Give me the iOS OAuth client ID from Google Cloud (looks like
`1234567890-abc123.apps.googleusercontent.com`). Native Google sign-in only becomes testable in a
TestFlight build - the keyboard change can be checked in the preview immediately.

# Fix post-password green screen, keyboard-covered fields, walkthrough centring, Google sign-in flakiness

## 1. Green "Signing you in" screen after creating a password

Confirmed cause: saving the password calls Supabase `updateUser`, which fires a `USER_UPDATED` auth event. `AuthContext` treats that event exactly like a fresh sign-in and flips the global `loading` flag back to true (`src/context/AuthContext.tsx`, line 147). Every protected route then swaps the whole app for the branded lime loading screen while the profile re-fetches - which is what appears between the password step and the walkthrough.

Fix: only enter the global loading state when there is no profile loaded yet (true initial sign-in). For `USER_UPDATED` (and any refresh where a profile is already in memory) refresh the profile quietly in the background without blanking the UI. The password step then hands straight to the walkthrough.

## 2. Text fields covered by the keyboard

Current behaviour: the shared handler in `src/lib/keyboardAware.ts` tries to lift the whole dialog by the overlap amount, but it clamps the lift so the surface never passes the top of the screen. The signup dialog is taller than the space left above the keyboard, so the clamp wins and the lower fields (Last Name, Confirm password) stay hidden.

Fix - make the surface fit instead of only sliding it, with no permanent space added:

- Publish the live keyboard height as a CSS variable on `<html>` for both native and browser (already partially done for native).
- While the keyboard is open, cap dialog, drawer and sheet content to the visible area above the keyboard and let its body scroll, so a tall form always has somewhere to scroll to.
- Keep the existing lift logic as the secondary step: with a real scroll container present, the focused field is scrolled into view rather than clamped.
- No reserved padding, no spacer, no footer strip, and nothing that stays behind: the cap and the scroll are applied only while the keyboard is up and fully removed the moment it closes, so every screen looks exactly as it does today when no field is focused.
- Apply this at the shared `ui/dialog`, `ui/drawer` and `ui/sheet` level so it is genuinely app-wide, not per-screen.


## 3. Walkthrough group not centred

`src/components/OnboardingCarousel.tsx` centres the group but then subtracts a large bottom padding (`pb-[calc(84px+safe-area)]`), pushing everything upward, and the slide content adds further `mt-8` / `mt-14` offsets.

Fix: remove the one-sided bottom padding, apply equal top/bottom breathing room, and trim the internal top margins so the media, text, dots and button read as one block with the same space above and below on all screen sizes.

## 4. Google sign-in returning to the app with nothing happening

On native the sheet closes (`browserFinished`) and the app polls for a session for 6 seconds. If the session lands slightly later, or the sheet was closed by our own deep-link handler, the flow silently ends with no session, no error and no visual state - the app just looks like it did nothing.

Fix:

- Persist a "OAuth in progress" marker when the sheet opens and clear it only when a session arrives or the user cancels.
- While that marker is set, show the branded waiting screen instead of the bare auth screen, so the return is never a dead end.
- Distinguish a programmatic close (deep link succeeded) from a user dismissal, and keep listening for the auth state change rather than only polling a fixed window.
- If it truly fails, surface a clear message with a retry instead of silently returning.

## Technical scope

- `src/context/AuthContext.tsx` - background refresh on `USER_UPDATED`.
- `src/lib/keyboardAware.ts`, `src/index.css`, `src/components/ui/dialog.tsx`, `drawer.tsx`, `sheet.tsx` - keyboard-safe max height + scroll.
- `src/components/OnboardingCarousel.tsx` - balanced vertical centring.
- `src/lib/oauthPopup.ts`, `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx` - durable native OAuth state and branded waiting/error handling.

No database or edge function changes.

## Verification

- Local screenshot checks for the walkthrough centring and for a focused field in the signup dialog with a simulated keyboard inset.
- Type check.
- Native Google sign-in and the password step need a TestFlight pass to confirm on-device.

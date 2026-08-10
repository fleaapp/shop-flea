# Fix native signup keyboard visibility and overlapping onboarding

## Goal

Make the signup sequence strictly:

```text
Profile details -> Password saved -> Walkthrough finished/skipped -> Welcome alert/toast
```

Only one layer may be visible at a time.

## 1. App-wide keyboard awareness (no footer, padding, or added space)

One global behaviour for every screen, dialog, drawer, and sheet in the app:

- Whenever a field is focused and the keyboard covers it, shift the surface that owns the field upward by exactly the overlap plus a small margin - nothing more.
- Prefer scrolling when the field sits inside a real scroll container; when there is no scrollable ancestor (centred dialogs, fixed shells), translate the surface itself upward instead.
- Reverse the shift completely when focus moves to a visible field, the keyboard closes, or the surface unmounts, so nothing is left displaced.
- Remove the existing bottom-padding injection used by the current native keyboard handler. No padding, no reserved footer strip, no permanent empty space anywhere.
- Consolidate the duplicated keyboard logic (the global handler and the separate hook) into one implementation so the two can no longer fight each other.
- Respect existing composer lifts so chat inputs are not double-shifted.

This addresses the confirmed cause of the cut-off Last Name field: centred `DialogContent` is fixed-position with no scrollable ancestor, and the app root is locked against document scrolling on native, so the current scroll-based helper has nothing to move.


## 2. Replace the race-prone signup triggers with one coordinator

- Keep one user-scoped signup stage as the sole source of truth for profile, password, walkthrough, and welcome state.
- While profile or password setup is active, synchronously suppress and close both onboarding surfaces - the welcome-tour dialog and carousel - rather than relying on a post-render context flag.
- Remove the delayed `checkAndTriggerOnboarding()` path from this signup flow. Its uncancelled timer can open onboarding after the stage has changed.
- Open the walkthrough exactly once only after the password stage reports a successful save.
- Reset transient walkthrough completion state for each new user so a previous guest/account session cannot make the welcome notification fire early.

## 3. Do not advance until the password is really saved

- Change `PasswordSetupDialog` to await the password update, password metadata update, and profile update before calling `onComplete`.
- Keep the password dialog open with an actionable error if any required save fails.
- Only persist the per-user password-complete flag and advance to the walkthrough after those writes succeed.

The current dialog calls `onComplete()` before `auth.updateUser({ password })` runs, so the walkthrough can begin while the password dialog and background save are still active.

## 4. Send welcome only from walkthrough completion

- Replace the shared `walkthroughDone` effect trigger with an explicit completion callback from both Finish and Skip.
- On that callback, close onboarding first, persist completion for the current user, then invoke the idempotent welcome notification function.
- Preserve the existing welcome alert copy and push behaviour, but prevent it from firing during profile or password setup.

## Verification

- Native-sized test: focus username, first name, last name, password, and confirm password; each focused field and the next relevant content remain visible without a new footer or permanent padding.
- Fresh Google/Apple signup: verify profile only, then password only, then walkthrough only, then the welcome alert/toast.
- Background and resume during every stage: verify the same stage resumes without duplicate overlays or welcome notifications.
- Existing user and guest walkthrough: verify normal onboarding still works and no signup dialogs appear.

## Technical scope

- `src/components/WelcomeSetupDialog.tsx`
- `src/components/PasswordSetupDialog.tsx`
- `src/pages/Index.tsx`
- `src/context/OnboardingContext.tsx`
- `src/components/AuthenticatedProviders.tsx`
- A small reusable keyboard-shift hook may be added for the two dialogs.
- No database migration or backend change is required.
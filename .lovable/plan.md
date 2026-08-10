# Fix native signup keyboard visibility and overlapping onboarding

## Goal

Make the signup sequence strictly:

```text
Profile details -> Password saved -> Walkthrough finished/skipped -> Welcome alert/toast
```

Only one layer may be visible at a time.

## 1. Move signup dialogs above the native keyboard

- Add keyboard-aware positioning to the profile and password dialogs so the whole dialog shifts upward only as far as needed when a focused field would be covered.
- Calculate the shift from the focused input and the visible keyboard boundary, then restore the original centred position when focus changes or the keyboard closes.
- Do not add bottom padding, a footer, or permanent empty space.
- Keep the dialog within the visible top safe area and allow its existing content to remain usable on smaller iPhones.

This targets the confirmed issue in `WelcomeSetupDialog`: its fixed, centred `DialogContent` has no scrollable ancestor, while the app root is locked against document scrolling on native. The current keyboard helper therefore cannot move the last-name field into view.

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
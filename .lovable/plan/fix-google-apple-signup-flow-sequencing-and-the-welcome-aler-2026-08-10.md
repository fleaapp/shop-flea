# Fix Google/Apple signup flow, sequencing, and the welcome alert

## 1. Google sign-in as an account-picker popup, still in-app

Today the Google button hands off to the managed OAuth broker as a full page/redirect, which on native feels like leaving the app.

Change:
- Web: use the popup mode of the managed OAuth helper so a small Google account-chooser window opens over the app and closes itself on success (no full page redirect).
- Native iOS: open the same managed OAuth URL in an in-app browser sheet (SFSafariViewController via Capacitor Browser) instead of a full redirect. The sheet slides up over Flea, shows the Google account picker, and is dismissed programmatically as soon as the callback lands on the universal-link origin. The session is then applied in-app.
- Keep `prompt: select_account` so the account chooser always appears.
- Keep the `flea_oauth_signup` flag so post-signup steps still know this was an OAuth signup.

## 2. Fix the overlapping-dialogs deadlock after Google signup

Right now three things can fire at once (password dialog, onboarding walkthrough, welcome toast), which locks the screen.

Introduce one ordered post-signup state machine on the home screen. Only one stage is ever visible:

```text
1. Username / name setup   (WelcomeSetupDialog)
2. Create password         (PasswordSetupDialog, OAuth signups only)
3. App walkthrough         (onboarding welcome dialog + carousel)
4. Welcome to Flea toast   (+ alert and push)
```

Specifics:
- The onboarding trigger (`checkAndTriggerOnboarding`) is blocked until both profile setup and, for OAuth users, password setup are complete — not just on the current partial condition.
- The welcome notification is no longer sent when the username dialog completes; it fires only after the walkthrough is finished or skipped (still server-side idempotent, so it can only ever send once).
- The walkthrough opens only from the password dialog's completion for OAuth users, and from the username dialog for email signups.
- Each stage persists its completion per-user in localStorage so leaving/reopening the app resumes at the right stage rather than replaying earlier ones.

## 3. Welcome alert shows real copy in Alerts

The Alerts list renders "New notification" because the `welcome` type has no mapping.

- Add a `welcome` case to the notification title/message and emoji mappings so the row reads the real welcome copy with the coupon code and a 👋 icon, matching the toast and push text.
- Existing welcome rows already store the correct title/message in the database, so previously created alerts will render correctly too.

## Technical notes

- `src/pages/Auth.tsx`: popup/in-app-browser OAuth handling for Google (and the same treatment for Apple's web fallback).
- `src/pages/Index.tsx`: replace the current interleaved flags with the ordered stage machine described above; move `sendWelcomeNotification()` to after onboarding completes.
- `src/context/OnboardingContext.tsx`: expose a completion callback so the home screen knows when the walkthrough finished or was skipped.
- `src/hooks/useNotifications.ts`: add `welcome` to `getNotificationMessage`/`getNotificationEmoji`.
- No database or edge function changes required.

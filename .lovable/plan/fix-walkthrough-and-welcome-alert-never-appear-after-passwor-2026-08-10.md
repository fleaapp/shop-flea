# Fix: walkthrough and welcome alert never appear after password setup

## What's actually wrong

After the password dialog completes, the signup machine does reach the walkthrough stage, but the walkthrough only opens when the local flag `flea-new-user-pending-onboarding` is set. That flag is currently set in exactly one place - the "Browse as Guest" button. No signup path (Google, Apple, or email) ever sets it.

So for a fresh Google signup:

```text
Profile details -> Password saved -> [walkthrough skipped, flag absent] -> welcome alert never fires
```

The welcome alert is gated on "this session's walkthrough was opened and then finished", so when the walkthrough never opens, the welcome notification never fires either.

## The fix

1. Mark a fresh account as pending onboarding at the moment the account is created - for Google, Apple, and email signup alike - so the walkthrough is expected for real signups, not just guests.
2. Treat the signup machine itself as sufficient: when a user has just completed profile setup and (for OAuth) password setup in this session, open the walkthrough even if the pending flag is missing. This makes the sequence self-healing for accounts created before this fix.
3. Guarantee the welcome alert. Fire it once the walkthrough finishes or is skipped, and also fire it if the walkthrough could not be shown at all, so a brand new account always receives the welcome alert and coupon in Alerts.
4. Keep the ordering intact: profile -> password -> walkthrough -> welcome, one surface at a time, unchanged from the current guard behaviour.

## Verification

- Fresh Google signup on native and web: profile dialog, then password dialog, then the walkthrough, then the welcome alert appears in Alerts and as a toast/push.
- Same for Apple and email signup.
- Skipping the walkthrough still produces exactly one welcome alert.
- Existing signed-in users see no walkthrough and no duplicate welcome alert.
- Guest browse walkthrough is unchanged.

## Technical scope

- `src/pages/Auth.tsx`: set the pending-onboarding flag on successful signup paths (OAuth start and email signup), not only guest browse.
- `src/pages/Index.tsx`: relax the walkthrough trigger so a just-completed signup opens it, and add a fallback that sends the welcome notification when the walkthrough cannot open.
- No backend, database, or edge function changes; `send-welcome-notification` stays idempotent.

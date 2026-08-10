# Make post-signup onboarding and welcome delivery deterministic

## Confirmed failure

The current fix still has two competing sources of signup state:

- OAuth starts by setting only `flea_oauth_signup`; unlike email signup, it does not persist `flea-new-user-pending-onboarding` before leaving the auth screen.
- `Index.tsx` relies on its local `justSignedUp` state plus effects to hand control from the password dialog to `OnboardingContext`. That state is not durable across a route remount, auth refresh, or native app lifecycle transition.
- The welcome alert is then gated by a completion counter that only advances if that effect-managed carousel successfully opened. When the handoff is lost, both the walkthrough and alert are skipped.

## Fix

1. Persist a user-scoped post-signup stage for Google, Apple, and email accounts as soon as a new-account flow starts.
2. Move the ordered sequence into one durable controller in `OnboardingContext`:

```text
profile setup -> password setup -> walkthrough -> welcome alert -> complete
```

3. After the password saves, explicitly advance the controller to `walkthrough` and open it - do not depend on a separate `Index.tsx` effect noticing several flags in the correct render.
4. Keep the signup-dialog guard active until the password dialog has closed, then open the walkthrough on the next frame so the two surfaces cannot overlap.
5. When the walkthrough is completed or skipped, explicitly advance to `welcome`, invoke the idempotent welcome-notification function, and then mark the flow complete.
6. Resume from the saved user-scoped stage after navigation, auth refresh, app backgrounding, or a native restart. Clear the saved stage only after the welcome request has been attempted.
7. Remove the transient `justSignedUp`, completion-counter fallback, and duplicate pending-flag checks from `Index.tsx` so there is only one authority for sequencing.

## Verification

- Test fresh Google, Apple, and email accounts through the full sequence.
- Confirm only one setup surface is visible at any time.
- Background and reopen the app after profile setup, after password setup, and during the walkthrough; each resumes at the correct stage.
- Complete and skip the walkthrough separately; each produces exactly one welcome row in Alerts and one eligible toast/push.
- Existing users and returning logins do not receive onboarding or duplicate welcome alerts.

## Technical scope

- `src/pages/Auth.tsx`
- `src/pages/Index.tsx`
- `src/context/OnboardingContext.tsx`
- `src/components/AuthenticatedProviders.tsx`
- Existing welcome-notification function remains idempotent; no new database table is required.
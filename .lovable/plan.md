## Problem

When the user backgrounds the app on step 4 (BSB / account number) of Seller Onboarding and returns, the sheet snaps back to step 1 instead of staying on step 4.

## Root cause (verified from code)

`SellerOnboardingSheet.tsx` initializes `step` from `profile.stripe_onboarding_step` inside an effect whose deps are `[open, profile, user?.id]`. Two things break resume:

1. **Effect refires on every `profile` reference change.** When the app resumes, `AuthContext` re-fetches and hands back a new `profile` object. The init effect runs again and *resets* form + step from whatever `profile.stripe_onboarding_step` says. If the write of `"4"` hadn't landed / been re-read yet, or if the profile row served is stale, the step drops back to 1.
2. **Two sheet instances race.** `PaymentMethodsSection` renders one `SellerOnboardingSheet`, and `SellerOnboardingResumeMount` renders another. On resume, the mount opens *its* sheet even if the user's original sheet is still open, and its fresh init reads whatever profile has — again clobbering the current step.
3. **Step write can silently fail** under the `profiles_update_guard` RLS (no error surface today), so DB never actually stores `"4"` and the "resume" flow has nothing to read.

## Fix

Make step resume purely local (localStorage), independent of profile round-trip and RLS. Stop letting profile refreshes clobber the current step. Prevent duplicate sheets.

### Changes

1. **`src/lib/sellerOnboardingResume.ts`** — extend to persist the current step per user:
   - `setOnboardingStep(userId, step)`, `getOnboardingStep(userId): 1|2|3|4|null`, and clear it inside `clearOnboardingResume`.
   - Key: `flea_seller_onboarding_step_${userId}`.

2. **`src/components/SellerOnboardingSheet.tsx`**
   - In the init effect, change deps to `[open, user?.id]` only (drop `profile`) so profile refreshes on resume don't re-run the reset. Read `profile` inside the effect without subscribing.
   - Compute resume step as: `getOnboardingStep(userId) ?? Number(profile.stripe_onboarding_step) || 1`. Local wins.
   - In the "persist step" effect, also call `setOnboardingStep(user.id, step)` (synchronous, cannot fail). Keep the DB write as a best-effort backup.
   - Keep `clearOnboardingResume` on explicit close and on completion (it will also clear the stored step).

3. **`src/components/SellerOnboardingResumeMount.tsx`**
   - Only auto-open when no other sheet is already showing. Add a lightweight guard: check `document.querySelector('[data-seller-onboarding-sheet="open"]')` before calling `setOpen(true)`; and tag the sheet's root `DrawerContent`/`SheetContent` with `data-seller-onboarding-sheet={open ? 'open' : 'closed'}` in `SellerOnboardingSheet.tsx`.
   - This prevents the resume mount from stacking a second sheet over the one the user is already viewing.

4. **No schema / RLS changes.** DB step column stays as a backup only; we no longer depend on it for resume correctness.

## Verification

- Open onboarding from Settings, advance to step 4, background the app for 30s, return → sheet stays on step 4 with BSB/account inputs intact.
- Cold-relaunch the app while resume flag is set → resume mount reopens the sheet on step 4.
- Explicitly close the sheet (X / backdrop / "Not now") → resume flag + stored step cleared; next open starts at step 1.
- Complete onboarding → flag + stored step cleared.
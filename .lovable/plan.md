## Problem

The onboarding form data is already saved locally, and the current step is saved to `profiles.stripe_onboarding_step`. But when the app is fully relaunched (native cold-start after backgrounding), the sheet is closed and no one reopens it — the user lands on Profile/Dashboard and has to hunt for the "Set up seller" button to get back in. Radix keeps the sheet open across a normal foreground/background cycle, so this only bites on relaunch.

## Fix (frontend only)

Add a global "resume onboarding" flag stored in localStorage, and mount a single always-listening component that reopens the sheet at the saved step when the flag is set.

### 1. Resume flag helpers (`src/lib/sellerOnboardingResume.ts`, new)

- `setOnboardingResume(userId)` — writes `flea_seller_onboarding_resume_${userId} = "1"`.
- `clearOnboardingResume(userId)` — removes it.
- `hasOnboardingResume(userId)` — boolean read.

### 2. Wire flag into `SellerOnboardingSheet.tsx`

- When the sheet opens and the user advances past step 1 (i.e. `handlePersonalNext`, or reaches step 2/3/4 via the requirements-driven jump), call `setOnboardingResume(user.id)`. This ensures we only try to resume when the user has actually engaged, not for a "Not now" tap on step 1.
- In `handleVerifiedSuccess` and after a successful `handleContinueToStripe` completion (the paths that already call `clearOnboardingDraft`), also call `clearOnboardingResume`.
- Route explicit user-close through a wrapper: when `onOpenChange(false)` fires from the "Not now" button, the X close, or backdrop dismiss, clear the resume flag. Backgrounding does not fire `onOpenChange`, so the flag survives a real leave-and-return.

### 3. Global resume mounter (`src/components/SellerOnboardingResumeMount.tsx`, new)

- Consumes `useAuth()`; renders nothing when there is no user.
- On mount and on Capacitor `App` `resume` / web `visibilitychange` → visible, checks: user present, `hasOnboardingResume(user.id)`, and `profile.stripe_onboarding_complete !== true` (skip if seller already finished). If so, sets local `open = true` and renders `<SellerOnboardingSheet open={open} onOpenChange={...} />` — the sheet's existing effect will rehydrate step from `profiles.stripe_onboarding_step` and draft fields from localStorage.
- Passes `onComplete` that clears the flag and closes.
- Mount this component once inside `AuthenticatedProviders` so it's available on every authenticated route without duplicating logic in Profile / CreateListing / SellerDashboard / PaymentMethodsSection.

### 4. Avoid double-mounting

The existing per-page `<SellerOnboardingSheet>` instances stay as-is (they handle the "user tapped Set up seller" and "action required" entry points). Because Radix Dialog allows only one modal at a time and the resume mount only opens when the page-owned instance is closed, they will not overlap in practice. If both happen to try to open in the same tick, the page-owned sheet takes precedence — the resume mount reads `hasOnboardingResume` on mount only and won't reopen once the user-triggered sheet takes over and eventually clears the flag on completion.

### Verification

- Start onboarding, enter details on step 2, background the app, cold-relaunch → sheet reopens on step 2 with fields prefilled.
- Reach step 4 (bank), background, relaunch → sheet reopens on step 4.
- Tap "Not now" on step 1 → flag never gets set, sheet stays closed on next launch.
- Tap X on step 3 → flag cleared, sheet stays closed on next launch.
- Complete onboarding → flag cleared, no resume on next launch.
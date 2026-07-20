## Problem

The onboarding sheet already resumes the correct **step** (persisted to `profiles.stripe_onboarding_step`), but every field is reset to empty on open (`src/components/SellerOnboardingSheet.tsx` lines 91–99). So when the user leaves the app to grab their BSB / account number / address / DOB and returns, they land on the right step but with blank inputs — feeling like a full reset. The `BankDetailsStep` internal `bsb` / `account` state has the same problem.

## Fix

Persist in-progress form values locally per user and rehydrate on open. Keep step persistence server-side as it is.

### Changes (frontend only — `src/components/SellerOnboardingSheet.tsx`)

1. **Draft storage helper** (module-local):
   - Key: `flea_seller_onboarding_draft_${user.id}`.
   - Shape: `{ firstName, lastName, dob, dobInput, phone, line1, suburb, state, postcode, bsb, account }`.
   - Small `loadDraft(userId)` / `saveDraft(userId, partial)` / `clearDraft(userId)` wrappers around `localStorage` with try/catch.

2. **Rehydrate on open** (replace the reset block at lines 91–99):
   - Merge order: profile prefill (`first_name`, `last_name`) → draft override.
   - Only clear/reset when there is no draft.

3. **Autosave on change**:
   - One `useEffect` watching the personal + address fields → `saveDraft(user.id, { ...fields })` (debounced via microtask is fine; volumes are tiny).
   - In `BankDetailsStep`, lift initial values from draft and save on change the same way (pass `userId` + `initialDraft` in as props, or read `localStorage` directly inside the component to keep the diff small).

4. **Clear draft** in these terminal paths:
   - Successful completion of `BankDetailsStep` (after the external account is attached and `onDone` fires).
   - When the sheet detects the account is fully verified (existing success path that closes the sheet).
   - On explicit "start over" / account reset flows if any exist (none identified; skip if not present).

5. **Do not** persist sensitive full account numbers longer than needed:
   - Only keep `bsb` + `account` in localStorage while the sheet is mid-flow; wipe on completion (step 4 done) and on successful verification. This matches how a user expects "resume where I left off" without leaving card numbers behind indefinitely.

### Out of scope

- No backend/schema changes. `stripe_onboarding_step` already covers server-side resume.
- No changes to ID verification step (photos are captured live and shouldn't be cached).
- No changes to Stripe edge functions.

### Verification

- Open sheet, fill step 2 partially, background the app, reopen → fields still populated, correct step.
- Complete flow → reopen sheet (e.g. for re-verification) → starts clean.

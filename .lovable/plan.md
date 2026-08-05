# Seller onboarding copy and layout tweaks

## Goal
Polish the first and fourth steps of the in-app seller onboarding sheet so the copy is tighter, the hierarchy is clearer, and the legal links sit on their own line.

## Changes

### Step 1 — `src/components/SellerOnboardingSheet.tsx`
1. Replace the two-line intro under the title with a single sentence:
   - **From:** `Set up your seller account in just a few minutes.` + `We'll ask for a few details to verify your identity and enable payouts.`
   - **To:** `Start selling in minutes with quick identity verification and secure payouts set up.`
2. Increase the visual weight of `Selling on Flea is free.`
   - Bump it from the surrounding `text-sm` size to `text-base` (or `text-lg`) and keep `font-semibold` so it reads as the key value prop.
3. Move the Terms / Privacy links onto their own line so the legal copy does not wrap awkwardly with the agreement sentence.

### Step 4 — `src/components/SellerOnboardingSheet.tsx`
1. Remove the paragraph: `Used to verify your identity and enable payouts. Your details must match your bank account and government-issued ID.`
2. Keep the remaining line `Australian addresses only. Never shown publicly on your profile.` and ensure it is centered and balanced (it already is, but verify after the removal).

## Out of scope
- No functional changes to onboarding logic, validation, or persistence.
- No changes to other steps, the ID verification camera flow, or the bank-details step.

## Verification
- Typecheck the project.
- Open the seller onboarding sheet and confirm step 1 and step 4 render the new copy and layout correctly on mobile viewport.

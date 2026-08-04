# Seller Onboarding Flow Update

## Goal
Improve the first impression of seller onboarding and add an explicit ID-matching education step before collecting personal details.

## Changes

### 1. Refine Step 1 intro screen
Update `src/components/SellerOnboardingSheet.tsx` step 1 with the requested hierarchy and more vertical breathing room:

- **Bold heading**: "Start selling on Flea"
- Body line 1: "Set up your seller account in just a few minutes."
- Body line 2: "We'll ask for a few details to verify your identity and enable payouts."
- **Bold subheading**: "Selling on Flea is free."
- **Bold subheading**: "You only pay a 2% + $0.50 transaction fee to cover payment processing when an item sells."
- Footer: "By continuing you agree to our" with linked "Terms & Privacy".

Implementation notes:
- Split the single paragraph into discrete blocks so spacing can be controlled.
- Use `space-y-` tokens to add breathing room between sections while keeping the overall sheet compact.
- Keep the existing Flea logo, "Step 1 of N" label, Continue button, and Not now secondary action.

### 2. Insert new Step 2: ID matching reminder
Add a new onboarding step immediately after the intro and before the personal-details form.

Content:
- Large emoji: 🪪
- **Bold, larger text**: "Your details must match your government-issued ID."
- Body: "Our payment processing provider uses this information to confirm your identity and activate seller payouts."

Behaviour:
- Continue button advances from Step 2 → Step 3 (the existing personal-details form).
- Back button returns to Step 1.

### 3. Re-number existing steps
The current 4-step flow becomes 5 steps:

```text
Step 1  Intro
Step 2  ID match reminder  (new)
Step 3  Your details       (was Step 2)
Step 4  Your address       (was Step 3)
Step 5  Bank details       (was Step 4)
```

Update:
- `TOTAL_STEPS` constant from `4` to `5`.
- Progress dots array from `[1,2,3,4]` to `[1,2,3,4,5]`.
- Conditional step renders: `step === 2` for the new screen, shift form steps to `3`, `4`, `5`.
- Navigation `setStep(...)` calls inside each step's Back/Continue buttons.
- Resume validation range from `dbStep <= 4` to `dbStep <= 5`.

## Files to edit
- `src/components/SellerOnboardingSheet.tsx`

## Out of scope
- No changes to form fields, validation, or backend edge functions.
- No changes to the bank-details sub-component other than step-number references.

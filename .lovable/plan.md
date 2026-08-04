# Seller onboarding copy/layout tweaks

## Goal
Tighten the first two steps of the seller onboarding sheet so the text balances better and the ID-matching requirement is clearer.

## Changes

### Step 1 — `src/components/SellerOnboardingSheet.tsx`
- Split the intro paragraph so **"Set up your seller account in just a few minutes."** stands on its own line/paragraph.
- Move the **Terms & Privacy** agreement line onto its own line/paragraph so it is not tacked onto the end of another block.
- Keep existing styling (`text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto`).

### Step 2 — `src/components/SellerOnboardingSheet.tsx`
- Update the heading to: **"Your details must match your government-issued ID & bank account."**
- Add a **💳** emoji next to the existing **🪪** emoji in the step icon.

## Verification
- TypeScript typecheck passes.
- Visual check of the onboarding sheet in the preview confirms the text layout and emojis.

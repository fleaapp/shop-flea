## Goal
Align the Payment Methods "seller" row button text and its status label so users with unfinished onboarding see the correct wording (not "Pending review").

## Changes — `src/components/PaymentMethodsSection.tsx` only

Text-only edits. No behaviour, no routing, no data logic changes.

### 1. Button label (line 282)
Restore the original wording. Change:
- `Set up Seller` → `💸 Become a Seller`

(`Seller Dashboard` stays as-is for fully verified sellers.)

### 2. Status label priority (lines 237–246)

Currently `stripeDetailsSubmitted` is checked before the "saved onboarding step" branch, so a user who exited midway can be shown "🔍 Pending review" even though they still have a saved step to resume.

Reorder + rename so unfinished onboarding always wins over the "Pending review" label:

```
if (stripeFullyConnected)                       -> Balance: …
if (stripeActionRequired)                       -> ⚠️ Action required
if (hasSavedOnboardingStep && !stripeDetailsSubmitted)
                                                -> ✏️ Setup unfinished — tap to continue
if (stripeDetailsSubmitted)                     -> 🔍 Pending review
if (stripePending)                              -> ⏳ Verifying…
if (stripeAccountId)                            -> ✏️ Setup unfinished — tap to continue
default                                         -> Not connected
```

This guarantees a user mid-flow (saved step, Stripe hasn't received a submitted onboarding yet) sees the "unfinished / continue" copy instead of "Pending review".

## Out of scope
- No changes to `SellerOnboardingSheet`, routing, resume logic, or any edge functions.
- No changes elsewhere in the app.

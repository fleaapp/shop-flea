## Cause

The dark line above the sheet is **not** a shadow — it's an intentional 3px charcoal top border on the sheet content. My earlier fix removed borders/shadows from the shared `Sheet` primitive (`src/components/ui/sheet.tsx`), but individual sheets override `className` with their own `border-t-[3px] border-charcoal` decoration.

Confirmed on two bottom sheets:
- `src/components/SellerOnboardingSheet.tsx:318` — `rounded-t-3xl border-t-[3px] border-charcoal ...`
- `src/components/PushPermissionSheet.tsx:70` — `rounded-t-3xl border-t-[3px] border-charcoal ...`

The screenshot is the Seller Onboarding sheet, so that border is what the user sees as the "shadow/dark line" running across the top.

## Fix (frontend only)

Drop `border-t-[3px] border-charcoal` from those two SheetContent classNames, keeping `rounded-t-3xl` so the rounded top edge remains.

Files:
1. `src/components/SellerOnboardingSheet.tsx` — line 318
2. `src/components/PushPermissionSheet.tsx` — line 70

Leave the dialog/modal borders (`CreateListing`, `PasswordSetupDialog`, `WelcomeSetupDialog`, `TieredShippingSetupModal`, `Swiping101Dialog`) untouched — those are centered card dialogs where the full charcoal outline is part of the brand look and the user hasn't complained about them.

### Verification

- Reopen Seller Onboarding on native — rounded cream top with no dark seam.
- Trigger the push permission sheet — same clean top.
- Spot-check the branded confirmation dialogs still show their full charcoal outline.
## Problem

Last change added `env(safe-area-inset-bottom)` on top of the existing bottom padding in drawers/sheets. On iOS the inset is ~34px, so `pb-[calc(2rem+env(safe-area-inset-bottom))]` renders as ~66px — buttons now float too high above the home indicator. Original project convention (per memory) was a flat `pb-8`/`pb-10` with no safe-area addition, and that's what the user wants back.

## Fix

Revert the padding in every file touched in the previous safe-area pass back to the original flat values. Do **not** touch any other logic.

### Files & exact revert

1. `src/components/ui/drawer.tsx` — `DrawerFooter`:
   - `pb-[calc(1rem+env(safe-area-inset-bottom))]` → `pb-4` (matches memory: `px-4 pt-3 pb-4`)

2. `src/pages/ListingDetails.tsx` — `[data-listing-footer]`: revert to prior `pb-8` (or whatever it had before — will check file before edit).

3. `src/components/checkout/CardDetailsSheet.tsx`:
   - `pb-[calc(2rem+env(safe-area-inset-bottom))]` → `pb-8`

4. `src/components/checkout/WalletPaySheet.tsx`:
   - `pb-[calc(2rem+env(safe-area-inset-bottom))]` → `pb-8`

5. `src/components/ChangePasswordSheet.tsx`, `ChangeEmailSheet.tsx`, `ShippingSettingsSheet.tsx`, `NewChatForm.tsx`, `WriteReviewDrawer.tsx`, `FilterSheet.tsx`:
   - Same revert: strip the `+env(safe-area-inset-bottom)` addition, restore original flat `pb-8` / `pb-4` value that was there before the safe-area pass.

6. `src/index.css` — remove the PWA/Capacitor `env(safe-area-inset-bottom)` overrides added in the same pass; leave the rest of the file untouched.

### Why this is correct

The vaul drawer sits above the home indicator already; adding safe-area inset double-counts it. Original `pb-8` (32px) sat visually right for the last year of the project and matches every other footer.

### Not touching

No changes to overlay chrome, scroll-restore, or any business logic.

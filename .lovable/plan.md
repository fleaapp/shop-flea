## Goal
Consolidate the delete (🗑️) action so it lives in exactly one place: the Listing Details footer (already added, to the left of "Edit Listing"). Remove the duplicate from the profile grid card.

## Changes

**`src/components/ProfileGridCard.tsx`**
- Remove the 🗑️ button from the top-right action pill on active listings (the block that renders 🗑️ + ✏️ over each thumbnail in 2-column grid view).
- Keep the ✏️ edit button in place (unchanged position, styling).
- Remove the now-unused `AlertDialog` confirmation, `setConfirmOpen`/`confirmOpen` state, and the delete mutation/handler tied to it.
- Clean up any imports that become unused (AlertDialog, toast if only used for the removed handler, etc.).

**No other files change.**
- `src/pages/ListingDetails.tsx` keeps the 🗑️ button in the seller footer with its existing confirmation dialog.
- Single/swipe view on Profile is unchanged (no bin there — deletion happens by opening the listing).

## Notes
- Behavior for owners: to delete a listing, open it → tap 🗑️ in the footer → confirm.
- No DB, RLS, or edge-function changes.

# Bundle offers button styling

Make the "Bundle offers" button under the shipping price on Create Listing and Edit Listing match the other input boxes and the Settings-style rows.

## Changes

- Add `w-full` so the button spans the full form width like the price inputs.
- Replace the text `›` character with the Lucide `ChevronRight` icon (`h-5 w-5 text-muted-foreground`), matching the Settings rows.
- Keep the existing `inputStyles` (h-14, rounded-2xl, muted background) plus `flex items-center justify-between px-4` so the label sits left and the chevron right.

## Files

- `src/pages/CreateListing.tsx` - bundle offers button (around line 890)
- `src/pages/EditListing.tsx` - bundle offers button (around line 739)

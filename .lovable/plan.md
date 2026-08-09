# Consistent toggle styling app-wide

Some toggles (Create Listing / Edit Listing "Offers", Cancel Item "relist", admin transaction filters) render lime-on-lime because the base Switch defaults to a lime track *and* a lime knob when on. The toggles in Settings, Offers and Filters look right only because each one manually overrides the colours.

## What changes

Make the correct look the default, so every toggle matches without per-screen overrides:

- Off: grey track, grey knob
- On: dark charcoal track, lime knob

## Technical detail

- `src/components/ui/switch.tsx`: change the Root default to `data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-input`, and the Thumb to `data-[state=checked]:bg-lime data-[state=unchecked]:bg-muted-foreground` (tokens already in the design system).
- Remove the now-redundant duplicate className overrides on the switches in `src/pages/Settings.tsx` (2), `src/pages/Offers.tsx`, and `src/components/FilterSheet.tsx` so there is a single source of truth.
- Untouched-but-fixed by inheritance: `src/pages/CreateListing.tsx`, `src/pages/EditListing.tsx`, `src/components/CancelItemDialog.tsx`, `src/components/admin/transactions/TransactionFilters.tsx`.

# Offers toggle on listing forms

Add an "Offers" row directly under the Bundle offers button on Create Listing and Edit Listing, styled the same as the other boxes but with a switch on the right instead of a chevron. When it is on, the auto-accept offer input (and its helper line) appears beneath it; when off, they disappear.

## Behaviour

- The switch controls the seller's account-level offers setting (`offers_enabled` on the profile), the same one on the Offers screen - so turning it on here also enables offers everywhere.
- Toggling saves immediately, refreshes the profile, and shows a toast ("Offers on" / "Offers off"), matching the Offers screen.
- Switch is disabled while saving.
- Auto-accept price input stays exactly as it is today, just now driven by this toggle.

## Technical details

- New row uses the shared `inputStyles` box (h-14, rounded-2xl, muted background) with `w-full flex items-center justify-between px-4`, label "💰 Offers" on the left, shadcn `Switch` on the right.
- Handler mirrors `handleToggleOffers` in `src/pages/Offers.tsx`: update `profiles.offers_enabled` by `user_id`, `refreshProfile()`, toast on success/failure.
- Files: `src/pages/CreateListing.tsx`, `src/pages/EditListing.tsx`.

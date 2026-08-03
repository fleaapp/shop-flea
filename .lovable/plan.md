# Seller Info UI Tidy-Up

## What we’re changing

1. **Listing Details drawer seller card**
   - Remove the review-star line and the "Last active" line from the username/location box.
   - The seller card should show only: avatar, username, location.

2. **Seller Profile header**
   - Keep the existing star-rating bubble that opens reviews.
   - Add a second bubble immediately to its right showing `⏱️ <last active>` (e.g. "⏱️ Active today"), using the existing `formatLastActive` helper.
   - Both bubbles should sit on the same horizontal row below the username.

## Files to touch

- `src/pages/ListingDetails.tsx` — strip rating/last-active lines from seller card.
- `src/pages/SellerProfile.tsx` — render last-active bubble next to the reviews bubble.

## Out of scope

- No backend or data changes; both `rating` and `last_sign_in_at` are already fetched.
- No navigation or interaction changes beyond what already exists.

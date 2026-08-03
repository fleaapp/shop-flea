# Listing details drawer - seller card, listing age, price breakdown

Five changes to the listing details drawer (`src/pages/ListingDetails.tsx`).

## 1. Listing age

Show how long ago the listing was created (e.g. "2 hours ago", "4 days ago", "1 week ago") on the right side of the row that holds the listing title, so it sits horizontally aligned with the item name. Styled as muted small text matching the seller card's secondary text.

## 2. Price info button

Add a small circular info button (ⓘ) next to the price. Tapping opens a Flea-style drawer titled "Total" showing:

```text
Item price                        $5.00
Shipping                         $15.00
Secure Checkout Fee               $0.95
  This fee keeps Flea running and protects
  every purchase:
  - Buyer protection on every order
  - Secure payments and payouts
  - Fraud detection and prevention
  - Support when something goes wrong
Total                            $20.95
```

Numbers come from the existing fee helper (`calculateFees`, 4% + $0.70), so the drawer always matches checkout. Uses the standard Flea drawer style (top-10 offset, rounded, px-4 padding, safe-area footer padding) and short dashes.

## 3. Three-dots menu

Collapse "Report listing" and "Report seller" into a single "🚩 Report listing" item. Seller reporting stays available on the seller profile screen, where it already exists.

## 4. Last active

Add a line under location in the seller card showing last active, derived from the seller's last sign-in (e.g. "Active today", "Active 3 days ago", "Active 2 weeks ago"). If the seller has been inactive 10+ days, use the existing inactive treatment wording rather than a plain timestamp.

## 5. Rating and reviews

Add a line under last active in the seller card: filled/empty stars plus the review count, e.g. `⭐️⭐️⭐️⭐️★ 4.6 (23)`. If the seller has no reviews yet, show "No reviews yet".

## Technical notes

- Seller fetch in `ListingDetails.tsx` currently selects `username, avatar_url, location, country_code, offers_enabled`; extend it to also pull `rating`, `total_reviews`, `last_sign_in_at`. These columns already exist on both `profiles` and the `profiles_public` view, so no schema or policy change is needed.
- Listing `created_at` is added to the listing select and the state/snapshot hydration paths so shared-link and cached opens still render an age.
- New component `src/components/PriceBreakdownDrawer.tsx` for the price breakdown; it takes item price and shipping and calls `calculateFees` from `src/utils/feeCalculator.ts`.
- Star rendering follows the existing review convention (⭐️ filled / ★ empty).
- Seller card grows to three secondary lines; row layout switches to `items-start` so the price block stays top-aligned with the card.

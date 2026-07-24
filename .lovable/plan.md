## Goal
Close the two inactive-seller (10+ days since `last_sign_in_at`) gaps so their listings don't appear in the home feed and can't be checked out.

## Changes

### 1. Home feed SQL — exclude inactive sellers
Update the `get_home_feed(p_limit, p_offset)` DB function via migration:
- In the `candidates` CTE, extend the seller filter (currently excludes `status = 'blocked'` and `pause_selling = true`) to also exclude sellers where `p.last_sign_in_at IS NOT NULL AND p.last_sign_in_at < now() - interval '10 days'`.
- Also apply the same inactive exclusion to the unauthenticated branch that returns newest active in-region listings (currently no seller filter at all — add a `LEFT JOIN profiles` there for parity with paused/blocked/inactive).
- No signature or return-type change; keep all other logic (scoring, interleave, fallback) identical.

### 2. Checkout — block inactive-seller items
In `src/pages/Checkout.tsx` (line ~142), update the `validItems` memo:
- Change from `items.filter((item: any) => !item.isPaused && item.status !== 'sold')`
- To `items.filter((item: any) => !item.isPaused && !item.isInactive && !item.isRemoved && item.status !== 'sold')`
- This mirrors how Cart already filters and prevents an inactive-seller item that slipped through from being charged.

## Out of scope
- No UI copy changes — overlays and toasts already exist.
- No changes to Cart, Favorites, WishlistCard, SellerProfile (already gated).
- No change to the 10-day threshold or `last_sign_in_at` trigger.

## Verification
- Run the migration; spot-check `get_home_feed` output does not include a seller with `last_sign_in_at` older than 10 days.
- Confirm Checkout page skips inactive items in the totals/PaymentIntent payload.

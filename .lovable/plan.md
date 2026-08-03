# Bundle Offer Badge

Show a small lime bubble banner wherever a seller has bundle offers turned on.

## Badge content

Driven by the seller's saved bundle mode:

- `free` - "Free ✈️ on bundles"
- `discounted` - "20% off ✈️ on bundles"
- `item_discount` - "📦 10% off bundles"
- `none` - nothing rendered

Style: light lime background with a lime border, lime-tinted text, rounded-full pill, small text. Uses existing design tokens (primary lime), no hardcoded hex.

## Where it appears

1. **Seller profile** - centered under the reviews / last-active bubbles row, above the Listings|Sold toggle.
2. **Listing details drawer** - centered at the top of the image area, on the same row as the 3-dot menu (right) and cart/wishlist stats (left), so it sits between them.

## Technical notes

- New shared component `src/components/BundleOfferBadge.tsx` taking `mode`, `discountPercent`, `itemDiscountPercent`; returns null for `none`.
- Seller profile already loads the profile; extend its `profiles_public` select with `bundle_shipping_mode`, `bundle_shipping_discount_percent`, `bundle_item_discount_percent`.
- Listing details does not fetch bundle settings today - add a lightweight lookup via the existing `fetchSellerShippingSettings` helper for the listing's seller.
- Long text is kept on one line; the badge is centered with `absolute inset-x-0 top-3` and horizontal padding so it never overlaps the icons.

## Out of scope

No changes to bundle pricing logic, cart, or checkout.

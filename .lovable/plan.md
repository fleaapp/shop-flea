# Bundle Offers (rename + item discount option)

Rebrand the seller "Bundle Shipping" feature as "Bundle Offers" with a 📦 emoji, and add a fourth option that discounts the items themselves rather than the shipping.

## The four options

1. No bundle offers - buyers pay each item's price and shipping in full.
2. Discounted shipping for bundles - X% off combined shipping on 2+ items.
3. Free shipping for bundles - shipping is $0 on 2+ items.
4. Discount on bundles (new) - X% off the seller's item subtotal on 2+ items. Shipping still charged in full.

Options stay mutually exclusive (one radio choice).

## Percentage picker

Replace the five fixed buttons with a Depop-style draggable slider: 5% to 50% in 5% steps, current value shown large above the track. Used by both the shipping-discount and the new item-discount option.

## Where the discount shows up

- Cart: per-seller group banner becomes "📦 Bundle offer: X% off items" (or the existing shipping wording for shipping modes), with the discount shown as its own line in the totals.
- Checkout: same banner treatment plus a "Bundle discount -$X.XX" line in the summary, above the Secure Checkout Fee.
- Fees: the buyer fee (4% + $0.70) is calculated on the discounted subtotal, so the discount reduces the total correctly.
- Seller payout: the seller absorbs the discount - their net is based on the discounted item price, with the 2% + $0.50 transaction fee applied after.
- Order records: each order row stores its own discounted price so receipts, sale details, and refunds all use the real amount charged.
- Refunds: pro-rata refund math uses the stored discounted prices, so partial refunds of a bundle stay accurate.

## Copy sweep

Every user-facing "Bundle shipping" string becomes "Bundle offers", with ✈️ replaced by 📦 in that feature only (shipping prices elsewhere keep their existing emoji). Covers the settings sheet, the seller setup modal, Settings menu row, cart, checkout, and receipts.

## Technical notes

- Migration: widen `profiles_bundle_shipping_mode_check` to allow `item_discount`, add `bundle_item_discount_percent integer`, expose it on `profiles_public` (view, `sync_profiles_public` trigger, and `get_profiles_public`).
- `src/utils/shippingCalculator.ts`: extend `BundleShippingMode` with `item_discount`, add `calculateBundleItemDiscount(itemPrices, mode, percent)`, and update `getBundleBreakdownText` to return the item-discount label. Shipping stays untouched in `item_discount` mode.
- `src/utils/shippingPrefs.ts`: persist the new mode and percent in the local fallback.
- `src/utils/feeCalculator.ts`: apply the item discount to the seller subtotal before buyer fees and before `computeSellerNet`.
- Frontend: `ShippingSettingsSheet.tsx`, `TieredShippingSetupModal.tsx` (four options + new slider component), `Cart.tsx`, `Checkout.tsx`, `Settings.tsx` row label.
- Edge functions: `stripe-connect-payment-intent`, `finalize-checkout`, and `stripe-connect-refund` each read the new column and apply the same discount math server-side, so the charged amount and stored `orders.price` values are authoritative and tamper-proof.
- Interaction with accepted offers: an item bought at an accepted offer price is excluded from the bundle item discount (no double discount); it still counts toward the 2+ item threshold.

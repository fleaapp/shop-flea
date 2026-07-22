## Bundle shipping — fix end-to-end

### Root cause

The bundle shipping data is saved correctly (verified: `@sarahhearn2` = `discounted` / `20%` in `profiles`). The **Checkout page** already reads the new `bundle_shipping_mode` fields via `fetchSellerShippingSettings` + `calculateTotalShipping`, so the discount is applied there.

The **Cart page** is still wired to the old tiered system. Its bundle label only renders when `settings.tieredEnabled` is true — but with the new bundle model that flag is `false`, so no label ever appears and the per-seller shipping total shown next to the checkout button is the raw un-discounted sum.

Everywhere downstream (Checkout order-summary line, receipts, order details, sales details) reads `orders.shipping_price` from the DB, and `finalize-checkout` already writes the seller total from the client's `shippingBySeller` map (which comes from the bundle-aware calculator). So once the Cart label + display are fixed and the buyer actually completes checkout, the discounted total flows through orders → receipt → sales details automatically.

Two smaller issues to also fix:

1. Checkout's per-seller order-summary shows `+${shipping} shipping` on the last item of every seller group. When the buyer has 2+ items from one seller with a bundle discount, this is technically correct (it's the combined total) but there's no indication the discount was applied — buyers won't know why the number changed. Add a bundle label above the shipping line.
2. `SalesDetailsSheet` and `OrderDetailsSheet` sum `shipping_price` per row. `finalize-checkout` currently stores the whole seller shipping total on the first row and `0` on the rest (`index === 0 ? sellerShipping : 0`), so the sum is correct. But the per-item line renders `+${o.shipping_price} shipping` for every row, which will show the full seller total next to one item and `+$0 shipping` next to the others. Change the per-item display to only show a shipping line once per seller group (matching Checkout's pattern) and label it as a bundle when applicable.

### Changes

**`src/pages/Cart.tsx`**
- Replace the tiered-shipping label block (lines ~390–412) with a bundle-aware label using `getBundleBreakdownText(availableItems.length, settings)`. Show:
  - `✈️ Free bundle shipping` when mode = `free` and 2+ available items.
  - `✈️ Bundle discount: N% off shipping` when mode = `discounted` and 2+ available items.
  - Nothing for `none` or single-item groups.
- Compute the seller's combined shipping via `calculateSellerShipping(availableItems, settings)` and display it (bold) next to / under the label so the buyer sees the actual bundled amount before tapping Checkout.

**`src/pages/Checkout.tsx`**
- In the per-seller Order Summary group (around lines 735–753), when `sellerItems.length >= 2` and the seller has a bundle mode, render a small `✈️ Bundle discount applied (20% off shipping)` / `✈️ Free bundle shipping` line above the `+$X shipping` total so the buyer understands the number.

**`src/components/OrderDetailsSheet.tsx` and `src/components/SalesDetailsSheet.tsx`**
- Group orders by seller (already effectively one seller per group), and render one shipping line per seller group showing the combined shipping. When the group has 2+ items, add the same bundle badge ("Bundle discount applied" / "Free bundle shipping"). Remove the per-item `+$X shipping` render so we don't show the full total against a single item and `+$0` against the rest.

**Receipt (`src/components/OrderReceiptDialog.tsx`)**
- Already sums correctly. Add a single "Bundle discount applied" note under the shipping subtotal when the order group has 2+ items and a bundle mode was used. To know the mode without a DB round-trip, infer it from the stored data: if summed `shipping_price` for the group < sum of listings' individual `shipping_price` (already available on the order rows via join, or refetch listings), show "Bundle discount". Simpler: fetch `bundle_shipping_mode` for the seller once when the dialog opens and label from there.

**No backend/schema changes required.** `finalize-checkout` and `stripe-connect-payment-intent` already honour the client `shipping` / `shippingBySeller` values, which are produced by the bundle-aware calculator.

### Verification

After the edits, with `@sarahhearn2` on `discounted 20%`:

1. As `@jcsbh`, add 2 items from `@sarahhearn2` to cart → Cart shows `✈️ Bundle discount: 20% off shipping` and the combined shipping total is 80% of the two items' shipping.
2. Tap Checkout → order summary shows the same bundle label + discounted shipping; Total reflects the discount.
3. Complete checkout → receipt, buyer Order Details, and seller Sales Details all show one combined shipping line per seller with the bundle badge.
4. Repeat with `free` mode → shipping shows `$0.00` and `✈️ Free bundle shipping`.
5. Checkout only one of the two items → no bundle label, full individual shipping charged.

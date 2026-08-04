# Order / Sale UI cleanup + bundle offers tidy

## 1. Item count stays on the username line
On order cards (Cart/Orders) and sale cards (Sales), the `• x2` count currently wraps to its own line on narrow screens.

Fix: keep the username and the count on one row - username truncates with ellipsis, the count and trailing full stop stay pinned beside it and never wrap.

## 2. Multi-item refund: select one, several, or all
Today the seller refund picker on a multi-item sale forces one item at a time.

Change:
- The picker becomes multi-select (tap to toggle, tick indicator) with a "Select all" control and a running "Refund N items" confirm button.
- The refund/cancel dialog accepts the selected set, shows all chosen items in the summary, and processes each one in sequence (same reason and relist choice applied to all), reporting a single success or a clear partial-failure message.
- Single-item sales behave exactly as now (straight to the dialog).

## 3. Order / Sale summary cleanup
Reorder both summaries to one consistent top-to-bottom order:

```text
Items (thumbnails + prices)
Items subtotal
Shipping (+ bundle offer note)
Coupon (buyer only, if applied)
Fees (last line before total)
Total bar
```

- Sale details currently shows Shipping -> Fee -> Items subtotal; it moves to subtotal -> shipping -> fee.
- Dividers on the sale sheet use a heavier border than the order sheet; both will use the same 1px hairline.
- Remove duplicated dividers and empty spacing wrappers so the rows sit evenly.

## 4. Bundle offers sheet is too tall
- Remove the "Choose the deal buyers get when they bundle your items." line.
- Tighten it: smaller header padding, condensed option rows (tighter padding, one short subtitle line each), shorter subtitle copy, tighter spacing around the percentage slider, and a compact footer button.

## 5. Shipping settings entry moves to its own button
- Remove the "Shipping settings ›" / "Tiered shipping ›" text inside the shipping price field on both Create listing and Edit listing.
- Add a dedicated full-width button directly under the shipping price box that opens the Bundle Offers sheet, styled like the other secondary buttons on those screens.

## 6. Remove the payout preview blurb
Delete the "If this sells on its own you'll receive $X after the 2% + $0.50 transaction fee..." paragraph from Create listing. The minimum-price validation message stays.

## Technical notes
- Files: `src/pages/Cart.tsx`, `src/pages/Sales.tsx`, `src/components/SalesDetailsSheet.tsx`, `src/components/OrderDetailsSheet.tsx`, `src/components/CancelItemDialog.tsx`, `src/components/ShippingSettingsSheet.tsx`, `src/pages/CreateListing.tsx`, `src/pages/EditListing.tsx`.
- Multi-refund loops the existing `seller_cancel_order_begin` RPC plus the `stripe-connect-refund` call per order id - no backend or schema changes.
- All changes are presentation-only apart from the refund loop; fee maths and totals are untouched.

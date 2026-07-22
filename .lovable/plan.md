## Bug
Opening an order drawer crashes into the app-wide ErrorBoundary ("Something went wrong / A small hiccup"). Root cause verified against `error_logs`: React error #310 (rules-of-hooks violation) originating from Cart.

## Cause
In `src/components/OrderDetailsSheet.tsx`, the `useQuery` for `seller-shipping-settings` (line 128) runs **after** the early return `if (!orders || orders.length === 0) return null;` (line 109). When the drawer is closed the component returns early; when a user taps an order it renders further and calls one extra hook → hook count mismatch → crash.

This regressed with the recent bundle-shipping wiring (`sellerShippingSettings` + `bundleText`).

## Fix
Move the `useQuery` for `seller-shipping-settings` (and the derived `bundleText`/`shippingTotal` computations) **above** the `if (!orders …) return null;` guard, so every render calls the same hooks in the same order. Use `primaryOrder?.seller_id` and gate with `enabled: !!primaryOrder?.seller_id && (orders?.length ?? 0) >= 2` so it stays inert when there's no order.

No other files change. No backend or edge-function changes.

## Verify
- Open Orders tab → tap the order from @sarahhearn2 → drawer opens with bundle shipping line ("X% off combined shipping" / "Free shipping on bundles").
- Close and reopen the drawer several times → no crash.
- Single-item orders still open (bundleText stays null).

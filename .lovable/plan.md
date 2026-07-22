## Simplify bundle shipping banner in Cart

The current banner appends a separate shipping amount line (e.g. "— Free combined shipping" or "— $4.50 combined shipping") which is confusing when items already ship free.

### Change
In `src/pages/Cart.tsx` (lines ~406-416), remove the suffix entirely and rely solely on `getBundleBreakdownText`, updating that helper to return the exact copy:

- **Discounted mode:** `✈️ Bundle discount: 20% off combined shipping`
- **Free mode:** `✈️ Free shipping for bundles`

The banner will render only the emoji + breakdown text, centered, with no extra amount or "Free combined shipping" suffix.

### Files touched
- `src/pages/Cart.tsx` — remove the `{' — '}` and amount branch, render only `bundleText`.
- `src/utils/shippingCalculator.ts` — update `getBundleBreakdownText` to return the two strings above.

No other UI or logic changes.
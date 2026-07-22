## Bundle shipping label: standardised copy + layout

### Copy
Both variants render with a single ✈️ and bold "Bundle shipping:" prefix:
- Discounted → **Bundle shipping:** `<N>% off combined shipping`
- Free → **Bundle shipping:** `Free shipping on bundles` (single ✈️ shown, same as discounted)

### Layouts

**Cart (`src/pages/Cart.tsx` ~396–407)** — one line, left-aligned, inside the seller card slot above the Checkout button:
```tsx
<div className="px-4 py-2 bg-accent/30 text-left text-xs text-accent-foreground">
  <span className="mr-1">✈️</span>
  <span className="font-bold">Bundle shipping:</span>{' '}
  <span>{bundleText.detail}</span>
</div>
```

**Checkout (`src/pages/Checkout.tsx` ~738–755)** — two lines, left-aligned. Move OUT of the per-seller item card into its own row in the totals section, **below the coupon code input and above the Secure Checkout Fee line**. Stack one block per qualifying seller.

**OrderDetailsSheet (~233), SalesDetailsSheet (~259), OrderReceiptDialog (~154)** — two lines, left-aligned, in place (replacing today's single-line `✈️ {bundleText}`). Receipt keeps 10px sizing but switches from `text-right` to `text-left`.

Two-line block:
```tsx
<div className="text-xs text-accent-foreground text-left">
  <div><span className="mr-1">✈️</span><span className="font-bold">Bundle shipping:</span></div>
  <div>{bundleText.detail}</div>
</div>
```

### Helper change
`src/utils/shippingCalculator.ts` — `getBundleBreakdownText` returns `{ detail: string } | null`:
- discounted → `{ detail: '<N>% off combined shipping' }`
- free → `{ detail: 'Free shipping on bundles' }`

Callers render the ✈️ and the bold "Bundle shipping:" prefix.

### Not touched
Bundle math, seller settings fetching, and which surfaces show the label — unchanged.
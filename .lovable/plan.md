## Changes

Update the two order-group card renderers used on the Sales screen (`src/pages/Sales.tsx`, `SaleCard`) and Orders screen (`src/pages/Cart.tsx`, `renderOrderCard`).

**1. Replace the timestamp with a total bubble (all cards, single or bundle)**

Remove the line that renders `formatTime(group.created_at)` / `formatOrderTime(group.created_at)`.

In its place, always render a small light-grey pill showing the group total, matching the amount displayed in the corresponding details drawer:

- **Orders card (buyer view, `Cart.tsx`)** — must equal the "Total amount paid" in `OrderDetailsSheet.tsx`:
  ```
  subtotal = Σ (price + shipping_price)
  processingFee = round((subtotal * 0.04 + 0.70) * 100) / 100
  total = subtotal + processingFee
  ```
- **Sales card (seller view, `Sales.tsx`)** — must equal `youReceived` in `SalesDetailsSheet.tsx`:
  ```
  total = Σ (price + shipping_price)
  ```
- Formatted as `$X.XX`.
- Style: `inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground` (same light-grey pill look). Placed where the timestamp used to sit, above the existing status pill.

**2. Bundle copy: `• N items` → `• xN`**

In both cards, change:
```tsx
{itemCount > 1 ? <span> • {itemCount} items</span> : null}.
```
to:
```tsx
{itemCount > 1 ? <span> • x{itemCount}</span> : null}.
```
Shorter label so the sentence stops wrapping.

**3. Cleanup**

Remove the now-unused `formatTime` / `formatOrderTime` helpers if nothing else references them.

## Scope

Frontend/presentation only. No changes to hooks, edge functions, DB, details drawers, admin, notifications, or receipts.

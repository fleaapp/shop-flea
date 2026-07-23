## Problem

Opening Sale details renders the app's error boundary ("Something went wrong"). The crash is a Rules of Hooks violation in `src/components/SalesDetailsSheet.tsx`:

- `useState`, `useEffect`, `useAuth`, `useQueryClient`, `useUnreadOrderMessages`, `useExistingReview` all run at the top.
- Then there's an early `return null` at line 103 when `orders` is empty.
- **After** that early return, `useQuery(['seller-shipping-settings', …])` is called (line 112).

When the sheet first mounts with `orders` still null/empty and then receives orders (or vice versa), the hook count changes between renders → React throws → error boundary shows "A small hiccup. Try again, or head home."

## Fix

In `src/components/SalesDetailsSheet.tsx`:

1. Move the `useQuery` for `seller-shipping-settings` up above the `if (!orders || orders.length === 0) return null;` guard, alongside the other hooks. Guard its `enabled` and `queryFn` against a missing `primaryOrder` (use `primaryOrder?.seller_id` and skip when absent — already partially there via `enabled`).
2. Move any derived values it depends on (`primaryOrder`) so they're computed before the hook but the early return stays below all hooks.
3. Keep behavior identical otherwise — no logic/UX changes.

## Verification

- Reopen Sale details on an order (single item and bundled) — drawer opens without hitting the error boundary.
- Bundle text still renders for 2+ item orders.

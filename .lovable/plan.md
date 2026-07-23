## Problem

The divider above "Shipping" in `src/components/OrderDetailsSheet.tsx` renders full-width in the browser preview, but on native iOS (WebKit inside Capacitor) it appears inset from the card edges. The divider below it (above "Secure Checkout Fee") renders correctly on both. Both dividers use identical markup (`<div className="border-t border-border" />`), so this is a native WebKit rendering quirk — likely related to a zero-height div's `border-top` being clipped or subpixel-rounded differently when the preceding sibling is a flex/image row versus a plain text row.

## Fix

In `src/components/OrderDetailsSheet.tsx`, replace both zero-height `border-t` divider divs inside the Order Summary card with an explicit 1px full-width element that renders identically on iOS WebKit:

```tsx
<div className="h-px w-full bg-border" />
```

This gives the separator a real box (not just a border on a collapsed div), which WebKit lays out consistently regardless of the preceding sibling's content. Apply the same swap to both separators so they stay visually matched.

## Scope

- Only `src/components/OrderDetailsSheet.tsx`, presentation only.
- No changes to `SalesDetailsSheet.tsx`, totals, bundle text, or any logic.
- User verifies on native after the next `npx cap sync` + rebuild.

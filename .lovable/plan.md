## Problem

The dark curved outline visible above the drawer's rounded top edge (see screenshot) is not a shadow on the drawer itself — it's the black backdrop that vaul (the drawer library) paints behind the scaled-down page when `shouldScaleBackground` is on. As the page scales down and gets rounded corners, the black body underneath peeks out around its edges, reading as a dark rim right above the sheet.

## Fix

Override vaul's wrapper background so the area behind the scaled page matches our app background instead of black.

In `src/index.css`, add a global rule:

```css
[data-vaul-drawer-wrapper],
[vaul-drawer-wrapper] {
  background: hsl(var(--background));
}
```

This removes the dark seam on every drawer without changing the scale-background animation or any drawer-specific styling.

## Verification

Open any drawer (e.g. Seller Onboarding sheet from the screenshot) and confirm the dark curve above the rounded top is gone while the dim overlay on the page behind still looks correct.

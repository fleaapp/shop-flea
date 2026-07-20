## Root cause

`src/pages/ListingDetails.tsx` line 495 sets `DrawerContent` to `h-[100svh] max-h-[100svh]`. The underlying `DrawerPrimitive.Content` is already `fixed inset-x-0 bottom-0` with `top: calc(env(safe-area-inset-top,0px) + 24px)` — it auto-fills that space.

Forcing `100svh` on top of `bottom: 0` makes the drawer taller than the visible viewport, pushing its bottom edge (and the footer buttons) ~68px off-screen on notched iPhones in native WKWebView. PWA masks it because Safari's collapsing chrome shrinks `svh`; native has no chrome to collapse, so the overflow becomes real clipping.

## Fix — one file

**`src/pages/ListingDetails.tsx`** (line 495):

- From: `className="mt-0 flex h-[100svh] max-h-[100svh] flex-col overflow-hidden rounded-t-3xl bg-background"`
- To:   `className="mt-0 flex h-full flex-col overflow-hidden rounded-t-3xl bg-background"`

That's it. The drawer will fill the primitive's bounds, the footer's existing `pb-12` becomes the actual visible bottom padding, and there is no gap under the footer box — identical to PWA.

## Audit

Grep `rg "h-\[100svh\]|max-h-\[100svh\]" src/` — if any other `DrawerContent` uses the same override, apply the same `h-full` change. Plain page containers using `min-h-[100svh]` (admin pages) are not drawers and stay as-is.

## Out of scope

No changes to Capacitor config, StatusBar, safe-area CSS, drawer primitive, or footer padding. No business-logic changes.
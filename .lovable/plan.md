## Problem

The native iOS status-bar strip and the WebView area below it show visibly different shades of gray whenever a Drawer / Sheet / Dialog / AlertDialog is open, producing a seam right under the Dynamic Island.

## Root cause (verified)

`src/lib/appChrome.ts::syncNativeStatusBar` dims the native status-bar strip by mixing **black at 40%** over the route colour:

```
dimColor('#F5F1EB', 0.4) → #93918D  (warm gray, cream + black)
```

But every overlay in the app (`drawer.tsx`, `sheet.tsx`, `dialog.tsx`, `alert-dialog.tsx`) uses `bg-foreground/50` — i.e. **charcoal `hsl(220 20% 20%)` at 50%** over the route colour:

```
foreground #29303D @ 50% over #F5F1EB → #8F9194  (cool bluish gray)
```

Warm gray strip (native) vs cool gray WebView (Radix overlay) = the seam the user is seeing.

## Fix

Make the native status-bar dim colour match the Radix overlay by compositing the same `--foreground` token at 50% over the route colour instead of black at 40%.

### Changes

**`src/lib/appChrome.ts`**
- Replace `dimColor(color, blackAlpha)` with `overlayTint(routeColor)` that:
  - Reads `--foreground` via `getComputedStyle(document.documentElement).getPropertyValue('--foreground')`, parses the `H S% L%` triple, converts to RGB. Falls back to `#29303D` if parsing fails.
  - Alpha-composites that foreground at **0.5** over the route colour and returns the hex result.
- In `syncNativeStatusBar`, use `overlayTint(color)` as the `stripColor` when `isOverlay === true`. Non-overlay path unchanged.
- Keep everything else (single `setOverlaysWebView({ overlay: false })`, WebView never resized, `Style.Dark` unchanged) exactly as-is so the earlier no-jump fix is preserved.

No changes to the Radix overlay classes, the drawer/sheet components, or `useOverlayChrome`. This is a pure colour-match change in one function.

## Verification

- Open a Drawer / Sheet / Dialog on the Settings screen: status-bar strip and the dimmed page immediately below it read as the same gray — no seam under the Dynamic Island.
- Same check on an auth-coloured route (lime `#DDFED7`) — strip should match the dimmed lime backdrop.
- Close the overlay: status-bar strip returns to the route colour with no flash.
- WebView does not resize when opening/closing overlays (regression check for the earlier fix).
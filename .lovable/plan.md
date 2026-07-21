## Problem

After logging into another account, sonner toasts appeared right-aligned and clipped off the right edge of the screen. Root cause is unconfirmed — needs verification during the fix — but the two most likely contributors are:

1. **Sonner mobile behavior.** On viewports the library considers "mobile," sonner applies `data-mobile="true"` to its container and can override `position="top-center"` with edge-anchored placement plus a per-side `mobileOffset`. If any state on that route changes those variables (e.g. width becomes narrow enough after a chrome reflow post-login), the toast list can pin right.
2. **Duplicate/stale Toaster.** `App.tsx` mounts `<Sonner position="top-center" />` alongside our wrapper which already sets `position="top-center"`, and spreads incoming props last. Not harmful today, but it hides bugs if a stale prop ever leaks in.

## Fix

Make the sonner container geometrically centered via CSS regardless of sonner's own positioning logic. This is a purely presentational change and guarantees toasts render centered even when sonner flips to mobile mode.

### In `src/components/ui/sonner.tsx`

- Keep `position="top-center"` and the existing top offset.
- Add an inline `style` on `<Sonner>` that pins the container: `left: 50%`, `right: auto`, `transform: translateX(-50%)`, `width: min(420px, calc(100vw - 24px))`, `maxWidth: calc(100vw - 24px)`.
- Add a small CSS block (either inline `<style>` in the component or in `index.css`) targeting `[data-sonner-toaster]` and `[data-sonner-toaster][data-mobile="true"]` to override sonner's mobile-anchoring CSS vars:
  - `--width: min(420px, calc(100vw - 24px));`
  - Force `left: 50% !important; right: auto !important; transform: translateX(-50%) !important;`
  - Reset `--mobile-offset-left` / `--mobile-offset-right` to `auto` so mobile mode can't pull toasts to an edge.
- Keep the existing toast width classes so individual toasts still fit the container.

### In `src/App.tsx`

- Remove the redundant `position="top-center"` prop on `<Sonner />` (the wrapper already sets it). Prevents future prop-override surprises.

## Verification

- Reload the preview, trigger a toast on the home route, then sign out, sign back in on a different account, and confirm toasts remain centered and fully visible at 375px, 390px, and 440px widths.
- Confirm no regression on desktop widths (toast still centered near the top, capped at 420px).

## Out of scope

No changes to toast content, duration, icons, or any calling code. No changes outside `src/components/ui/sonner.tsx` and the one prop removal in `src/App.tsx`.

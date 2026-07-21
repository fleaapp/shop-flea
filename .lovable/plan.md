## Status bar fixes

Two separate bugs, both purely native-strip color — no layout, no repositioning.

### 1. Drawer / dialog open + close flash

**What's happening (from the video frames)**
- On open: the native status strip snaps to the dimmed color one frame *before* the Radix/Vaul backdrop has faded in over the WebView. For ~100ms the strip is dark while the page below it is still fully cream — reads as a flash.
- On close: `useOverlayChrome` releases the moment `data-state` flips to `"closed"`, which is the *start* of the exit animation. The strip snaps back to cream while the backdrop is still visibly fading out over the WebView — same flash in reverse.

**Fix (in `src/lib/useOverlayChrome.ts` only)**
- On open, delay `pushOverlayAppChrome()` by one animation frame + a short tick (~30ms) so the WebView backdrop has begun fading in before the strip changes. If the overlay is already closed before the delay fires, cancel — never push.
- On close, do not release when `data-state` becomes `"closed"`. Instead attach `animationend` / `transitionend` on the overlay element and release only when the exit animation completes. Fall back to a 400ms timeout in case the animation event doesn't fire (Vaul drag-close path).
- Keep the unmount safety-net release so nothing gets stuck dimmed.

`appChrome.ts` itself does not change — the fix is entirely in how push/release timing is scheduled around the animation. This applies uniformly to Drawer, Dialog, Sheet, and AlertDialog because all four go through the same hook.

### 2. Onboarding walkthrough status bar stays cream

The tutorial (`src/components/OnboardingCarousel.tsx`) is a plain `<div class="fixed inset-0 z-[999]">` with `bg-charcoal/90` — not a Radix overlay, so `useOverlayChrome` never fires and the native strip stays cream while the WebView is fully dimmed.

**Fix (in `src/components/OnboardingCarousel.tsx` only)**
- While `open` is true, call `pushOverlayAppChrome()` once via a `useEffect`, and release it on close / unmount. Same mechanism the Radix overlays use; no visual repositioning.
- Spotlight slides (which use a lighter mask) still tint the strip — matches what the user described ("should match the screens").

### Out of scope
- No repositioning, no padding changes, no z-index changes, no changes to the overlay backgrounds themselves.
- No changes to auth/lime chrome behavior.

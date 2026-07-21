## Diagnosis

Both symptoms — headers clipped up under the notch AND lime showing under the bottom nav — come from **one stuck state** on `<html>`.

While on `/auth`, `appChrome.ts` adds `.boot-auth` to `<html>` and sets `--app-top-bg: hsl(var(--flea-lime))`. That class also suppresses the native safe-area padding on `#root` (so the auth screen can paint edge-to-edge lime under the status bar).

After sign-in, `navigate()` moves you to the app, but `restoreRouteAppChrome()` is not wired to fire on route change — so `.boot-auth` and the lime `--app-top-bg` variable stay on `<html>`. Result on any page you land on next:

- `#root` still has no `padding-top: env(safe-area-inset-top)` → headers slide up under the notch.
- `<html>` background is still lime → bleeds through the BottomNav's transparent safe-area padding at the bottom.

A hard refresh clears the class because the auth route isn't the entry point anymore — which is exactly why your clean refresh fixed both at once.

## Fix

**Only** clear the stuck state. No layout, safe-area, padding, or positioning values change anywhere.

1. `src/App.tsx` — add a `useEffect` on `location.pathname` that calls `restoreRouteAppChrome()` whenever the route is not `/auth*`. This removes `.boot-auth` and resets `--app-top-bg` back to `--background` the instant you leave auth.

2. `src/lib/appChrome.ts` — make `restoreRouteAppChrome()` idempotent and explicit: remove `.boot-auth`, clear the inline `--app-top-bg` override, and reassert `overlay: true` for the transparent edge-to-edge status bar we already agreed on. No other behavior changes.

3. Add a one-time safety net in `AuthContext` on `SIGNED_IN`: call `restoreRouteAppChrome()` after session hydration so even a hard-coded `window.location` post-auth redirect can't leave the class behind.

## What does NOT change

- No page's `native-safe-top`, `pb-*`, header height, or scroll shell is touched.
- BottomNav height, padding, and positioning stay identical.
- Element positions on Index, Profile, SellerProfile, OrderChat, Cart, etc. are byte-identical to the "good" screenshot.

The scroll-shell sweep and Error Logs / Support badge fixes stay parked — this plan is only the stuck-chrome bug.

## Verification

- Playwright: load `/auth`, sign in, land on `/`, assert `<html>` has no `.boot-auth` class and computed `background-color` on `html`/`body` equals `--background`. Screenshot Index and OrderChat and diff header top offset against the good state.
- Manual sanity: sign out → sign in → open OrderChat. Header sits below the notch, no lime strip under nav, no clean refresh needed.

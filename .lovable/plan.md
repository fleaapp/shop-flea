## 1. Speed up Apple Pay sheet

Right now tapping **Buy with Apple Pay** does a strictly serial chain of native/edge calls before PassKit renders:

1. `createPaymentIntent` (edge function round-trip)
2. `Stripe.initialize` (bridge call)
3. `Stripe.isApplePayAvailable` (bridge call — redundant, we already know the device supports it because we rendered the Apple Pay tile)
4. `Stripe.createApplePay`
5. `Stripe.presentApplePay`

Fix in `src/pages/Checkout.tsx` / `src/lib/nativeWallet.ts`:

- **Warm Stripe on mount.** As soon as Checkout mounts on iOS and a publishable key is known, call `Stripe.initialize(...)` once (idempotent). Skip the second `Stripe.initialize` inside `handleNativeWalletConfirm` if the key hasn't changed.
- **Pre-create the PaymentIntent** in the background when the user picks the Apple Pay tile (and refresh it if `total`, coupon, or shipping address changes). Cache `{ clientSecret, paymentIntentId, amount, publishableKey, livemode, ... }` in a ref. On tap, use the cached PI immediately; only fall back to creating one synchronously if the cache is stale/missing. Invalidate the cache on any input change and on unmount.
- **Remove the `Stripe.isApplePayAvailable` gate** inside `handleNativeWalletConfirm`. The wallet tile is only shown when `getNativeWalletPlatform() === 'ios'`, so the check is a duplicate bridge round-trip. Keep the try/catch around `createApplePay` — its error is enough to surface "not available".
- **Do not `await Stripe.initialize` on tap** when it was warmed on mount; kick it off during warm-up and only await if it hasn't resolved yet.

Result: on tap, we go straight into `createApplePay` → `presentApplePay` with an already-minted client secret, cutting three sequential round-trips out of the critical path.

Guardrails:
- If `total` / shipping / coupon changes after the PI was pre-created, discard the cached PI (the amount would mismatch what PassKit shows).
- Keep the existing live/test key-mode mismatch check.
- Card and Google Pay paths are unchanged.

## 2. Kill the lime footer strip after login

`src/index.css` paints `html` and `body` with `background-color: var(--app-top-bg)`. `--app-top-bg` is only defined by `applyAppChromeColor()` writing an inline style — there's no default in `:root`. During auth, that inline value is `#DDFED7` (lime) and `.boot-auth` is added. After sign-in the route change eventually clears `.boot-auth` and rewrites the var to cream, but the lime strip in the home-indicator safe-area keeps re-appearing app-wide because the reset isn't guaranteed on every path:

- `applyAppChromeColor` mutates `documentElement.style` and `body.style` — but the SIGNED_IN handler in `AuthContext.tsx` calls `forceRestoreRouteAppChrome()` while `pathname` is still `/auth`, so it re-asserts lime. If the post-login navigate uses `window.location` (or the redirect fires before `AppContent`'s `useLayoutEffect` re-runs), the lime var never gets rewritten.
- Even after the class is removed, there's no CSS fallback: `var(--app-top-bg)` with no default resolves to `initial` (transparent), and the WebView paints its own base color for the safe area — which on iOS ends up showing the last CSS-declared color if `--app-top-bg` was previously lime and still cached on `body`.

Fix (all in `src/index.css` + `src/lib/appChrome.ts`, no layout changes):

- **Add a hard default** in `:root { --app-top-bg: #F5F1EB; }` so the safe-area always resolves to cream unless auth explicitly overrides it.
- **Scope the lime override to `.boot-auth` only.** Change `applyAppChromeColor` so that on non-auth routes it does not write `--app-top-bg` inline at all — it calls `removeProperty('--app-top-bg')` on both `documentElement` and `body`. That way the `:root` default takes over immediately and no stale inline lime can survive.
- **Clear the SIGNED_IN safety-net trap.** In `AuthContext.tsx`, when SIGNED_IN fires, don't call `forceRestoreRouteAppChrome()` synchronously (pathname is still `/auth`). Instead, unconditionally strip the auth chrome (remove `.boot-auth`, remove inline `--app-top-bg`, remove inline `background-color` on html/body) and let the next route change re-assert the correct color. This guarantees no lime persists past sign-in regardless of who navigates.
- **Belt-and-braces**: also `removeProperty('--app-top-bg')` on `body` in the non-auth branch (currently we only touch `background-color` and `--background`).

Nothing about `#root`, `native-safe-top`, screen positioning, or the scroll-shell layout changes.

## Verification

- Native iOS build: cold-boot → log in with email/password → land on `/index` and `/admin` → confirm the home-indicator safe area is cream (no lime strip).
- Same flow via OAuth (Apple/Google) → confirm no lime strip after callback.
- Tap Apple Pay in Checkout → sheet appears without the current multi-second delay; total is correct (from the recently fixed cents conversion).

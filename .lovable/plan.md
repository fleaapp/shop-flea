Goal: remove the unwanted vertical scroll and lime overscroll bleed on native without changing the visible height/position of any element, except lower the Sales (💸) button on the user Profile so it isn’t sitting too high.

1. Preserve current heights
   - Keep `native-safe-top` on Home, Auth, Profile, and Seller Profile (same `env(safe-area-inset-top)` they use today).
   - For flow pages that currently inherit safe‑area padding from `#root` (Cart, Alerts, Settings, and any other in‑app flow page), apply `native-safe-top` to their outer container so their top offset stays identical after `#root` padding is removed.
   - No spacing, font size, header height, or button size changes.

2. Stop the document from scrolling on native
   - Remove `html.is-installed #root { padding-top: env(safe-area-inset-top) }` (its role is taken over by `native-safe-top` on each screen).
   - Lock `html`, `body`, and `#root` on native to the viewport height with hidden overflow so the app shell itself cannot scroll or rubber‑band.
   - Keep drawer/dialog behaviour unchanged.

3. Stop the lime bleed at the source
   - Update `appChrome.ts` so in‑app routes no longer paint the route colour onto `html` and `body`; only the auth/splash routes stay lime.
   - Ensure normal in‑app routes expose the cream app background if iOS ever rubber‑bands.

4. Convert scroll‑prone flow pages to fixed layout
   - Cart, Alerts, and Settings: switch outer wrapper to `fixed inset-0 flex flex-col overflow-hidden bg-background native-safe-top`.
   - Move only the list/content area into an internal `flex-1 min-h-0 overflow-y-auto overscroll-contain` container.
   - Keep sticky headers, tabs, and the bottom nav exactly where they render today.

5. Fix only the Profile Sales button position
   - On the user Profile screen, lower the top‑right Sales (💸) button so it no longer sits too high, without shifting the avatar, username, tabs, or grid.
   - Leave the Seller Profile and other screens unchanged.

6. Verify
   - Home, Cart, Alerts, Settings, Profile, Seller Profile, and Auth: no whole‑page vertical scroll, no lime strip at top or bottom.
   - Every element keeps its current visible height and position, except the Profile Sales button, which sits slightly lower.
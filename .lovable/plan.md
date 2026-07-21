## Plan

1. **Undo the layout-moving status bar change**
   - Remove the global `#root { padding-top: env(safe-area-inset-top) }` behavior that pushed screens upward/off-screen after the last change.
   - Restore the native status bar mode to the stable non-overlay layout so existing page positioning stays exactly where it was.

2. **Make drawer dimming match the screen, not darker**
   - Remove the extra DOM status-bar dim overlay that is currently stacking on top of the drawer backdrop and making the notch/status area darker than the rest of the dim.
   - Let the drawer backdrop itself be the only dim layer, so the status bar area uses the same opacity as the rest of the screen.

3. **Fix drawer coverage without repositioning elements**
   - Keep drawer content starting below the native status area, as it does now, but adjust only the overlay/backdrop coverage so there is no solid cream strip or dark stripe.
   - Do not change button/header/listing/card positions.

4. **Keep native resume/camera recovery stable**
   - Update the app chrome restore helper to reassert the stable status bar configuration after returning from native plugins, without toggling layouts.

5. **Verify on the affected screens**
   - Check Profile/listing details and drawer-open states against the screenshots: no clipped top elements, no extra-dark status bar, no cream strip, no dark stripe.
## What should happen

The status bar should not be a separate solid strip at all. It should behave like Booking.com/Instagram: the app’s WebView extends behind the iPhone status bar, so the normal screen, images, and drawer dim layer are visible underneath it.

## Important correction

Changing the native strip from lime to cream would still be wrong because it keeps a painted strip. The correct fix is to remove the strip behavior and make the status bar area transparent/live.

## Plan

1. **Switch iOS back to edge-to-edge status bar rendering**
   - Set the native status bar to overlay the WebView.
   - Stop painting the status bar with a route color, lime, cream, or drawer tint.
   - Keep the status bar icons readable, but let the page/backdrop underneath provide the visual background.

2. **Do not use the previous global padding hack**
   - Do not add `padding-top: env(safe-area-inset-top)` to `#root`.
   - Do not move page content, headers, cards, drawers, or buttons.
   - Do not add a fake DOM tint layer over the status bar.

3. **Use iOS safe-area handling at the native/WebView boundary**
   - Update the Capacitor iOS configuration so the WebView can draw behind the status bar while iOS keeps the content inset stable.
   - This is the key difference from the earlier attempt that caused elements to shift.

4. **Update the app chrome helper only for native status bar behavior**
   - Replace the current “force overlay false” recovery with “force transparent edge-to-edge”.
   - Re-apply that on app resume/focus because native plugins can reset status bar settings after camera/payment/share flows.
   - Leave drawer styling and page layout alone.

5. **Drawer behavior**
   - Because the drawer backdrop lives inside the WebView, once the WebView extends behind the status bar, the backdrop should naturally dim the status bar area at the same opacity as the rest of the screen.
   - No separate dim layer, no darker stacked strip.

## Files to change

- `capacitor.config.ts`
- `src/lib/appChrome.ts`

No drawer CSS, no page layout, no component positioning unless verification shows one specific fixed header still ignores the native inset.

## Verification

After rebuilding native:

- Home status bar area shows the live app background, not lime.
- Settings status bar area shows the live Settings background, not a solid strip.
- Listing detail/photo screens can extend visually behind the status area.
- Opening a drawer dims the status bar area exactly the same as the rest of the screen.
- No buttons or headers move up or get cut off.

After pulling the changes locally, run `npx cap sync ios` before opening Xcode. Also read the Lovable native mobile/Capacitor blog post before the next native rebuild.
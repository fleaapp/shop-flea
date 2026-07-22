## Same treatment as the status bar, applied to the bottom

The top strip was fixed by making the native status bar transparent and letting the WebView draw edge-to-edge underneath it (`StatusBar.setOverlaysWebView({ overlay: true })` in `src/lib/appChrome.ts`). The bottom cream strip is the mirror problem on the other end of the screen: the iOS WebView is inset from the bottom safe area, and its native `backgroundColor` (`#F5F1EB`) paints that inset region. Nothing in HTML/CSS can cover it because it's outside the WebView.

Apply the same "transparent, no element movement" fix to the bottom.

### `capacitor.config.ts`
- `ios.contentInset: 'always'` → `ios.contentInset: 'never'`
  Makes the WebView extend into the bottom safe area (edge-to-edge), exactly like `overlaysWebView: true` did for the top.
- Remove `ios.backgroundColor` (or set to transparent) so the native layer behind the WebView never shows through — matches the transparent status bar approach.

### No CSS/layout changes
- Auth screen: no padding, no repositioning. The page's lime background already fills `100svh`, so once the WebView is edge-to-edge, the lime paints all the way to the bottom of the device. Element positions do not change.
- In-app screens: no padding, no repositioning. Page background (cream) already fills `100svh` for the same reason.
- Bottom nav / listing footer / drawers: keep existing `pb-9` / `pb-12` / drawer padding. They were already clearing the home indicator with the native inset; with the inset gone, that same padding still clears it because the values were sized for the home-indicator area, not doubled on top of it.

### Why this matches the status bar fix, not a layout fix
- Status bar fix: native chrome made transparent, WebView draws underneath, HTML unchanged.
- Bottom fix: native inset removed, WebView draws underneath, HTML unchanged.
Both keep elements in their existing positions and just stop the native OS layer from painting a strip of its own color.

### Verification after the change
- Auth: focus and blur the email field repeatedly — no cream strip appears, logo/inputs/buttons stay put.
- Home / Profile / Seller Dashboard: bottom nav still sits above the home indicator, no visual shift.
- Drawers/sheets: bottom safe area is covered by the drawer surface, no cream gap.

Single-file change (`capacitor.config.ts`), then `npx cap sync ios` on the user's Mac.
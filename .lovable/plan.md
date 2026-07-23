## Problem

On native iOS, when the keyboard opens:
1. A black strip appears between the input bar and the keyboard (visible in the screenshot).
2. Text fields sometimes jerk upward when tapped.

**Root cause:** The `@capacitor/keyboard` plugin isn't installed. Combined with `contentInset: 'never'` and a transparent iOS `backgroundColor` in `capacitor.config.ts`, the WebView doesn't resize when the keyboard appears — so the native layer (black) shows through beneath our input, and WebKit's default "scroll input into view" behavior kicks in and shifts fields.

## Fix

1. **Add the Capacitor Keyboard plugin** to `package.json` and configure it in `capacitor.config.ts`:
   - `resize: KeyboardResize.Native` — WebView shrinks to match keyboard height, eliminating the black gap.
   - `resizeOnFullScreen: true`.
   - `style: KeyboardStyle.Light` — matches our cream/charcoal palette (no dark accessory bar mismatch).
   - Set iOS `backgroundColor` to the app cream (`#F4F2EB`) instead of transparent so any 1-frame gap during keyboard animation blends in rather than flashing black.

2. **Stop inputs from jumping** by opting out of WebKit's automatic input scroll:
   - In `ios-native` (Info.plist patch) set `KeyboardScroll` / plugin `scroll: false` (the plugin exposes `Keyboard.setScroll({ isDisabled: true })` at runtime).
   - Call it once at app boot in `src/main.tsx` behind a `Capacitor.isNativePlatform()` guard.
   - Our layouts already use `100dvh` / `--keyboard-safe-height`, so once the WebView itself resizes, footers stay pinned above the keyboard without any manual scrolling.

3. **User steps after this ships** (native rebuild required):
   - `git pull`
   - `npm install`
   - `npx cap sync ios`
   - Rebuild in Xcode / push to TestFlight.

## Files to change

- `package.json` — add `@capacitor/keyboard`.
- `capacitor.config.ts` — add `Keyboard` plugin block (`resize`, `style`, `resizeOnFullScreen`), change `ios.backgroundColor` from `#00000000` to `#F4F2EB`.
- `src/main.tsx` — on native boot: `Keyboard.setScroll({ isDisabled: true })` and `Keyboard.setAccessoryBarVisible({ isVisible: true })` (keeps the Done bar the user already sees).

No screen/component layout changes — the existing `dvh` heights and drawer/footer logic already handle a resizing WebView correctly.

## Out of scope

- Web/PWA keyboard behavior (unaffected — this is native-only config).
- The `Done`/chevrons accessory bar styling (native iOS system UI, not themeable).

I found the likely remaining source: even after `html/body` are painted lime, `#root` still uses `background: hsl(var(--background))`, and `--background` defaults to the cream app color. On iOS, there is a short moment where the WebView/root exists before the Auth page fully paints, so that root background can still flash cream.

Plan:

1. Update the boot script in `index.html`
   - When native + logged out/root startup is detected, set both:
     - `--app-top-bg` to lime
     - `--background` to the lime HSL token
   - This makes `#root` lime before React loads, not just the status/safe-area background.
   - Also keep the existing theme/status meta updates.

2. Update `src/lib/appChrome.ts`
   - Centralize the route chrome decision so auth-like routes and native logged-out cold boot apply:
     - top/status color: `#DDFED7`
     - root/page background token: lime HSL
   - Normal in-app routes continue to apply cream.
   - This prevents `restoreRouteAppChrome()` in `main.tsx` from resetting only the top color while leaving `#root` cream.

3. Add a native boot CSS guard in `src/index.css`
   - Add a tiny class/state hook for native logged-out boot so `html`, `body`, and `#root` stay lime until React reaches `/auth`.
   - Remove/disable that guard automatically once normal route chrome runs, so signed-in app screens are still cream.

4. Keep native splash behavior unchanged
   - No changes to `LaunchScreen.storyboard` or Capacitor splash timing.
   - The sequence should become: native lime splash → lime WebView/root → lime Auth screen, with no cream layer.

Local commands after the fix:

```bash
cd /Users/sarahhearn/Desktop/shop-flea
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Then in Xcode:

```text
Product → Clean Build Folder
Simulator → Device → Erase All Content and Settings
Run again
```

If the simulator still shows the old color after this, it is almost certainly iOS launch-screen/WebView caching rather than app code.
## Why the phone keeps showing the old version

Two things can cause this, and we'll close both:

1. **Stale `dist/` getting copied into iOS.** If `vite build` is skipped, `cap sync` copies whatever was in `dist/` last time — which can be days old.
2. **Capacitor loading a remote URL instead of the bundled files.** Right now `capacitor.config.ts` honors a `CAP_SERVER_URL` env var. If that's ever set on your Mac (even leftover from a previous shell), the app loads a live URL and ignores the freshly bundled code. Apple also rejects App Store builds that ship with this enabled, so it shouldn't exist as a normal path.

## Changes

1. **Remove `CAP_SERVER_URL` from `capacitor.config.ts`.** The iOS app will always load the bundled `dist/`. No live-reload shortcut, no risk of accidentally pointing at a remote URL, no App Store rejection risk.

2. **Replace the iOS scripts in `package.json` with one forceful command:**
   ```
   npm run ios:fresh
   ```
   It will:
   - delete the old `dist/` folder,
   - run `vite build`,
   - run `npx cap sync ios`,
   - open Xcode.
   
   This makes it impossible to ship a stale bundle.

3. **Keep the boot log marker** (`[boot] native bundle marker ... buildId: ...`) so if it ever happens again, we can confirm in Xcode's console which build the phone actually loaded.

## Your everyday command after this

```bash
git pull && npm install && npm run ios:fresh
```

Then in Xcode hit ▶.

## If the phone STILL shows the old version after that

The remaining cause is the iPhone caching the old install. One-time fix:
- Delete the Flea app from the iPhone (long press → Remove App → Delete App)
- Run `npm run ios:fresh` again, hit ▶ in Xcode

After that, every future build will be fresh automatically.
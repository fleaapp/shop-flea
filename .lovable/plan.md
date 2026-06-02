## Goals

1. Stop the doubled splash on native iOS cold boot.
2. Make it impossible to ship a stale web bundle inside the iOS app.

## Changes

### 1. `src/main.tsx` — skip marketplace reset purge on native

The `MARKETPLACE_RESET_VERSION` block currently runs on every platform. On a fresh iOS install, localStorage is empty so it triggers, wipes caches/SW, then calls `location.reload()` — the WebView boots twice, doubling perceived splash time.

Move the `isNativePlatform` detection above the reset block and wrap the entire reset block (including the async cache/SW purge + reload) in `if (!isNativePlatform)`. Native WebViews don't need this purge — they ship a fresh `dist/` with every build, and there's no service worker to clear.

### 2. `package.json` — add iOS sync script

Add:

```json
"scripts": {
  "ios:sync": "vite build && npx cap sync ios",
  "ios:run": "vite build && npx cap sync ios && npx cap open ios"
}
```

Now the iOS rebuild workflow is one command instead of two, which prevents the stale-bundle problem (missing "Terms & Privacy" line) from recurring.

## What this does NOT change

- Splash storyboard, `capacitor.config.ts`, `appChrome.ts`, service worker behaviour on web — all untouched.
- Web behaviour is unchanged: the reset purge still runs once per `MARKETPLACE_RESET_VERSION` bump on web/PWA.

## Verification steps (you, after I implement)

1. `npm run ios:sync`
2. Xcode → Product → Clean Build Folder → Run on device
3. Confirm: splash → auth in ~1 boot (no reload flash), and the auth screen shows the "By continuing you agree to our Terms & Privacy." line.

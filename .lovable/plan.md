## Honest reset

I checked `error_logs` for the Apple Pay diagnostic writes we added. There are **zero** entries from your failed taps — the log-and-see strategy is not working, so I'm dropping it. No more "let's capture the error on the next tap."

## What the git history actually says

Since the last working native build (`a30ec32d`, 2026-07-21 05:21 UTC), only two native-surface changes landed:

1. **2026-07-21 10:46** (`28a6b72f`) — `capacitor.config.ts`: `StatusBar.overlaysWebView` false→true, removed `StatusBar.backgroundColor '#DDFED7'`, `ios.backgroundColor '#DDFED7'`→transparent `#00000000`, `contentInset: 'never'`.
2. **2026-07-22 23:37** (`0057656c`) — added `scripts/patch-native-capacitor-packages.mjs`. It rewrites `node_modules/@capacitor-community/stripe/ios/.../StripePlugin.swift` to force `STPAPIClient.shared.stripeAccount = nil` on every init, and pins Stripe iOS SDK to `exact: "25.9.0"`.

**`on_behalf_of` is not a suspect** — it's been in `stripe-connect-payment-intent` since 2026-07-15, i.e. present in yesterday's working build. I was wrong to target it last round.

## Plan — binary revert, one change at a time

### Step 1 — Remove the Stripe plugin native patch
Edit `scripts/patch-native-capacitor-packages.mjs`:
- Keep `patchPushNotificationsPlugin()` (proven-required, unrelated to payments).
- Remove `patchStripePluginSwift()` and `patchStripePackageSwift()` calls and their functions.

That reverts the Stripe Capacitor plugin and iOS SDK to vendored defaults — the same binary shape as yesterday.

**You run:** `git pull` → `npm install` → `npx cap sync ios` → bump Build → Archive.

**Test Apple Pay.** If it works, stop — the patch was the regression.

### Step 2 — Only if Step 1 fails: revert capacitor.config
Restore `capacitor.config.ts` to the `a30ec32d` values:
- `StatusBar.overlaysWebView: false`
- `StatusBar.backgroundColor: '#DDFED7'`
- `ios.backgroundColor: '#DDFED7'`
- Remove `contentInset: 'never'`

This brings back the lime footer strip. That's a UI regression we solve differently after payments are green — not before.

**Test Apple Pay.** By construction, after Steps 1+2 the native surface is byte-identical to the working build (minus the neutral removals of preflight/diagnostic JS).

### Step 3 — Only if Steps 1+2 both fail
Something outside git changed (Apple Developer portal, provisioning profile, Xcode toolchain). At that point I stop guessing at code and we investigate the signing chain directly.

## What I will NOT touch
- `on_behalf_of` or anything in `stripe-connect-payment-intent`
- Merchant ID, entitlements, App.entitlements
- The idempotency retry / typed error responses (working correctly)
- Push notifications native patch (proven required)

Approve and I'll execute Step 1 only.
Understood — status bar and footer stay exactly as they are. Dropping Step 3 entirely.

## What is actually different from the last working Apple Pay build (`a30ec32d`)

Compared line-by-line against the working commit, only two Apple Pay-related things are still different (ignoring the status bar/footer, which we are not touching):

1. **Native Apple Pay frontend flow** — the working build called Apple Pay with the preflight, native failed-event listener, and AU allowed-country fields. The current build removed those and calls a simplified direct Apple Pay.
2. **Backend PaymentIntent shape** — the working build set the seller-routing field on the PaymentIntent. The current build removed it. Removing it did not fix Apple Pay, so keeping it removed means we are still not matching the working shape.

## Plan

1. **Restore the native Apple Pay code block to the exact working shape**
   - Restore the Apple Pay call, options, preflight, and native failed-event listener as they were in `a30ec32d`.
   - Keep it direct-to-Apple-Pay only (no payment provider sheet, no prewarm, no hidden sheet init).
   - Keep the newer typed on-screen error panel so failures are still visible.

2. **Restore the backend PaymentIntent parameters to the working shape**
   - Put the seller-routing parameter back on the PaymentIntent.
   - Keep destination routing and buyer fee handling unchanged.
   - Keep the newer safer idempotency versioning so stale attempts do not get reused.
   - Bump the request version so the next tap creates a fresh intent.

3. **Clean up the native patch script**
   - Remove the dead payment-provider patch functions from `scripts/patch-native-capacitor-packages.mjs` so they cannot silently come back.
   - Keep only the push notification bridge patch (which is unrelated and proven required).

4. **Do NOT touch**
   - `capacitor.config.ts` (status bar, footer, safe area — all left alone).
   - Any status bar / overlay / native background code.
   - Any Xcode signing, entitlements, merchant, or certificate setup.

5. **Push block after implementation**
   - Backend PaymentIntent change deploys immediately.
   - Frontend change only needs your normal build + sync + archive (no clean, no dependency reset).
   - I’ll give you one exact copy-paste block after the code changes land.

## Why this is different from previous "reverts"

Previous attempts changed one suspected thing at a time based on a theory. This change puts both the native Apple Pay call and the PaymentIntent shape back to exactly what `a30ec32d` sent — the build you confirmed worked — without touching anything else you have already fixed (status bar, footer, safe area).
## Problem

Your local `npm install` fails at the `patch-package` step:

```
ERROR Failed to apply patch for package @capacitor-community/stripe
patches/@capacitor-community+stripe+8.1.1.patch could not be parsed.
```

That patch was only adding a diagnostic method (`getApplePayEntitlements`) so the app could read the signed entitlements at runtime. It is **not** the fix for Apple Pay — the real Apple Pay fix is the Xcode signing/provisioning profile including `merchant.com.finditonflea.app`, which `setup-ios-native.sh` and your entitlements file already handle.

The patch was hand-written and `patch-package`'s parser rejects it. Rather than fight the parser, I'll remove the diagnostic path entirely so `npm install` succeeds and the build proceeds. The diagnostic was never load-bearing — if it's absent, `checkApplePayEntitlement` already falls back to `available: false`, and `runApplePayPreflight` skips the entitlement step and lets `Stripe.isApplePayAvailable()` decide, which is the same behaviour every other Stripe-Capacitor app uses.

The rest of your terminal output is clean:
- `npx cap sync ios` succeeded (10 plugins).
- `setup-ios-native.sh` verified entitlements, pbxproj wiring, Apple Pay merchant, and icons — all green.
- Vite chunk-size and dynamic-import warnings are cosmetic, not errors.

## Files to change

1. **Delete** `patches/@capacitor-community+stripe+8.1.1.patch` — the malformed patch that breaks `npm install`.
2. **Edit** `src/lib/nativeEntitlements.ts` — simplify to always return `available: false` so the preflight cleanly falls through to Stripe's own check. No more calling a plugin method that doesn't exist.
3. **Edit** `README-IOS.md` — remove the two lines that reference "Flea's patched native payment plugin" / "built into the patched native payment plugin".
4. **Edit** `scripts/setup-ios-native.sh` — change the verification line `entitlement checker: built into the patched native payment plugin` to say `entitlement checker: skipped (using Stripe's isApplePayAvailable)` so the script's output matches reality.

No changes to `applePayDiagnostics.ts` — it already handles `entitlement.available === false` correctly by skipping the entitlement branch.

## Expected outcome

After you re-run:

```bash
cd ~/Desktop/shop-flea
git pull
npm install          # succeeds, no patch error
npm run build
npx cap sync ios
bash scripts/setup-ios-native.sh
npx cap open ios
```

`npm install` completes cleanly, the iOS build proceeds, and Apple Pay behaviour is identical to before the patch attempt: it depends purely on the signed entitlement + provisioning profile from Xcode (which your entitlements file, `setup-ios-native.sh`, and Xcode capability already cover).

## Note

This does not "give up" on Apple Pay — it removes broken scaffolding. If Apple Pay still shows the PassKit "not available" alert after archiving with the current entitlements, the remaining lever is the provisioning profile on Apple's side (Certificates, Identifiers & Profiles → App ID → confirm Apple Pay Payment Processing is enabled and the merchant ID is checked, then regenerate the profile). Say the word if you want a plan for that verification pass.
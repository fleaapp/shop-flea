I agree this can work again. I found two concrete problems to fix in code/config, not a UI rewrite:

1. The current checkout still has part of the Apple Pay speed-up change: it intentionally skips `Stripe.isApplePayAvailable()` before opening Apple Pay.
2. The Apple Pay sheet amount can be different from the checkout total (`$1.50` vs `$1.35`) because the payment-intent function accepts client-supplied shipping instead of recalculating bundle shipping server-side.
3. The native setup script only checks that `CODE_SIGN_ENTITLEMENTS` exists somewhere in the Xcode project. It does not force every App build configuration to use `App/App.entitlements`, which can explain why Xcode shows the merchant ticked but `codesign` output is empty for the installed build.

## Plan

### 1. Restore the safer Apple Pay launch path
Update `src/pages/Checkout.tsx` so Apple Pay goes back to the reliable flow:

```text
Tap Apple Pay
→ create fresh PaymentIntent
→ run Apple Pay availability preflight
→ verify PaymentIntent amount exactly matches checkout total
→ createApplePay
→ presentApplePay
```

This removes the remaining “fast popup” shortcut that skipped Apple Pay preflight.

### 2. Block Apple Pay if the amount is wrong
Before showing the Apple Pay sheet, compare:

```text
PaymentIntent amount from backend
vs
checkout total shown in Flea
```

If they differ by even 1 cent, do not open Apple Pay. Show a Flea toast and log the mismatch so it does not reach the native Apple system alert.

### 3. Recalculate bundle shipping in the payment function
Update `supabase/functions/stripe-connect-payment-intent/index.ts` so the backend calculates shipping from database listing rows and seller bundle settings instead of trusting the client `shipping` number.

That fixes the `$1.50` Apple Pay sheet vs `$1.35` checkout total problem.

### 4. Send checkout amount context to the backend
Update the checkout request to send:

```text
expectedAmountCents
shippingBySeller
couponCode
```

The backend will use this as a validation check, not as the source of truth. If the backend-calculated amount does not match the Flea checkout total, it returns a clear error instead of creating a bad PaymentIntent.

### 5. Bump the PaymentIntent idempotency version
Update the payment-intent idempotency version so no stale PaymentIntent from this morning’s speed-up change can be reused.

### 6. Harden the iOS entitlement setup script
Update `scripts/setup-ios-native.sh` so it force-wires:

```text
CODE_SIGN_ENTITLEMENTS = App/App.entitlements
```

for every App build configuration, not just “if it appears somewhere”. This makes the local Debug build and Archive build both sign with the Apple Pay entitlement file.

### 7. Keep unchanged
No Stripe PaymentSheet. No external checkout. No deep links. No changes to the Flea-native payment UI, seller flow, fees, or manual card path except the shared amount validation.

## After implementation
You will need to run locally:

```bash
git pull
npm install
npm run build
npx cap sync ios
bash scripts/setup-ios-native.sh
npx cap open ios
```

Then build/run again and re-check:

```bash
APP="$(find ~/Library/Developer/Xcode/DerivedData -path '*/Build/Products/Debug-iphoneos/App.app' -type d | sort | tail -1)"
codesign -d --entitlements :- "$APP" 2>&1 | grep -A6 in-app-payments
```

The output must include:

```text
merchant.com.finditonflea.app
```
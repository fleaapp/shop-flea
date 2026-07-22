## Goal
Restore Apple Pay to its pre-morning behaviour (which was working) without touching the manual card path or the edge-function idempotency fix (both are working now).

## What to revert (Apple Pay only)
In `src/pages/Checkout.tsx`:
- Remove the pre-warm plumbing: `WarmedPi` type, `stripeWarmPromiseRef`, `stripeWarmedKeyRef`, `warmedPiRef`, `warmedPiAmountCentsRef`, `warmingPiRef`, `warmStripe`, `ensureWarmedPaymentIntent`, the basket-change invalidation effect, and the pre-mint `useEffect` that fires when the wallet tile is selected.
- Restore `handleWalletTap` to the original synchronous path on native: on tap → `createPaymentIntent(false)` → `Stripe.initialize({ publishableKey })` → `Stripe.createApplePay(...)` → `Stripe.presentApplePay()`. No cached PI, no pre-initialised Stripe.
- Keep `handleNativeWalletConfirm` for the actual PassKit call, but have it call `Stripe.initialize` inline instead of relying on the warm cache.

## What to keep untouched
- `supabase/functions/stripe-connect-payment-intent/index.ts` — the versioned idempotency key + one-shot retry stays. This is what unblocked manual card and is not the cause of the Apple Pay post-authorisation failure.
- `handleCardConfirm`, `handleSavedCardConfirm`, `handleWebWalletConfirm`, coupon logic, bundle shipping copy, and every other change from today.
- Native config (`capacitor.config.ts`, entitlements) — unchanged.

## Why this should fix Apple Pay
The pre-warm path was minting the PaymentIntent and calling `Stripe.initialize` ahead of the tap, sometimes with a slightly different context than what PassKit later handed back (warm PI amount, initialise-then-createApplePay ordering). Returning to the original serial flow — create PI → initialise → createApplePay → presentApplePay on the tap itself — matches the state Apple Pay was verified working in.

## Verification after the change
1. Native build, add item to cart, tap Buy with Apple Pay → PassKit sheet → Face ID → success screen.
2. Manual card still works (no edge-function changes).
3. FREEFLEA coupon still zeroes the fee (no edge-function changes).

## Trade-off (accepted)
Apple Pay sheet will take ~300-600 ms longer to appear after tap than the pre-warmed version — same latency as before this morning. That's the behaviour you had working.

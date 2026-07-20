# Fix npm install ERESOLVE conflict

## What's happening
Your local `npm install` fails because three Stripe packages disagree on which `@stripe/stripe-js` major to use:

- `@capacitor-community/stripe@8.1.1` requires `@stripe/stripe-js ^8.4.0`
- `@stripe/react-stripe-js@6.x` requires `@stripe/stripe-js >=9.5.0 <10`
- `@stripe/stripe-js` is pinned at `^9.10.0`

The Sunday-night build only worked because your `node_modules/` was already installed from an earlier state — the newly-pulled `package.json` never got a clean install. Today's `npm install` hit the conflict for the first time.

## Fix
Downgrade the two web Stripe packages to the v8-compatible line so all three peers agree. `@stripe/react-stripe-js@3.9.x` pairs with `@stripe/stripe-js@^8.4.0`, which is exactly what `@capacitor-community/stripe` wants.

Change in `package.json`:

```
"@stripe/react-stripe-js": "^3.9.2",
"@stripe/stripe-js": "^8.11.0",
```

(`@stripe/connect-js` and `@stripe/react-connect-js` stay as-is — they don't depend on stripe-js majors.)

Then locally:

```bash
cd ~/Desktop/shop-flea
rm -rf node_modules package-lock.json bun.lock
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

## Verification
- I'll typecheck after the version bump to confirm the Stripe Elements API surface we use (`Elements`, `useStripe`, `useElements`, `PaymentElement`, `ExpressCheckoutElement`) is unchanged between react-stripe-js 6 → 3.9. These hooks/components exist in both majors with the same signatures we call.
- If any call site breaks after the downgrade, I'll patch it in the same turn.

## Why not the other direction
Bumping `@capacitor-community/stripe` to a v9 wouldn't help — there is no v9 published; 8.1.1 is current. Using `--legacy-peer-deps` would mask the mismatch and can produce a broken Stripe runtime, so we're aligning the versions properly instead.

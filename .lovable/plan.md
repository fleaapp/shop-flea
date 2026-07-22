## Root cause (confirmed from logs)

Stripe returned:
`Keys for idempotent requests can only be used with the same parameters they were first used with. Try using a key other than 'flea-pi-6c149349774f4267692ab0198d5e970a'`

The Apple Pay speed-up work added:
- pre-warmed PaymentIntent creation from `useEffect`
- `payment_method_options: { card: { request_three_d_secure: "automatic" } }`
- coupon recalculation flow

The idempotency key is currently `flea-pi-sha256(user | sorted item ids | amountCents | saveCard flag)`. That key doesn't include coupon, 3DS options, or a code-version salt. When a basket was first submitted before today's deploy and then re-attempted after the deploy, Stripe sees "same key, different params" and rejects the request for 24h. Result: both Apple Pay and Add-new-card fail on that basket for that buyer.

## Fix plan

1. Strengthen the idempotency key in `supabase/functions/stripe-connect-payment-intent/index.ts`
   - Include a code-version salt (bumps whenever request params change).
   - Include coupon code, seller stripe account id, application fee amount, and a stable hash of the full PaymentIntent request body.
   - This guarantees any change to what we send Stripe produces a new key.

2. Retry-on-idempotency-conflict
   - Wrap `paymentIntents.create` so that if Stripe returns `type === 'idempotency_error'`, we retry once with a fresh random-suffixed key.
   - This unblocks any buyer already stuck from today's collision without them needing to wait 24h.

3. Keep Apple Pay pre-warm safe
   - Ensure the pre-warm path and the manual card path both go through the same hardened create-PI function, so they can never collide with each other on a shared key.

4. Verify
   - Deploy the edge function.
   - Watch `stripe-connect-payment-intent` logs for any remaining idempotency errors and confirm a fresh PI is created for both Apple Pay and manual card tests.

## Not part of this fix

- The screenshot's "Apple Pay Is Not Available in 'Flea'" iOS system alert is a separate native signing/provisioning issue (the archived build's provisioning profile didn't include the `merchant.com.finditonflea.app` entitlement). That needs to be handled by re-archiving with Apple Pay enabled on the App ID and provisioning profile via `scripts/setup-ios-native.sh`, not in the web code. Manual card checkout will start working immediately once the idempotency fix ships.
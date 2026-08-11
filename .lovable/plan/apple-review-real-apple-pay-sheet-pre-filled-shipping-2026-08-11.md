# Apple Review: real Apple Pay sheet + pre-filled shipping

## Problem (verified)
- Apple rejected review asking for "an account with all the shipping data so Apple can access Apple [Pay]".
- The `@applereview` account (`appreview@finditonflea.com`, id `5883f33c-…`) has `profiles.is_apple_reviewer = true` but **no row in `buyer_addresses`** (all fields NULL). Checkout blocks at `isShippingComplete` ("Please fill in all shipping details") before any payment method runs.
- The server-side demo bypass (`stripe-connect-payment-intent`, lines 225-246) returns `demo: true`, and `Checkout.tsx` (line 306-309) short-circuits to the success page **before** the Apple Pay sheet opens. So even with shipping seeded, a reviewer tapping Apple Pay would skip straight to "success" and never see the real Apple Pay sheet — which Apple will also reject.

## Goal
Let the Apple reviewer reach and complete a **real Apple Pay sheet** showing the correct AUD total, with **no captured charge** (authorization is voided immediately).

## Approach: manual-capture PaymentIntent + void
Stripe **test mode cannot process real Apple Pay tokens** from a real device, so "test mode, no charge" is not physically possible. Instead we use the live account with `capture_method: "manual"` (authorize-only): the Apple Pay sheet opens with the real amount, the reviewer authorizes, the PaymentIntent lands in `requires_capture`, and we void it right after — releasing the hold. No funds are captured, no transfer to the seller, no payout. (A temporary auth hold may briefly appear on the reviewer's card and drop off within a few days — standard and reversible for App Review.)

```text
Reviewer taps Apple Pay
  -> stripe-connect-payment-intent (reviewer branch)
       create PLATFORM PaymentIntent, capture_method=manual, amount = items+shipping+secure fee
       return real clientSecret/paymentIntentId (NO demo flag)
  -> Stripe.presentApplePay()  -> real Apple Pay sheet opens (correct AUD total)
  -> reviewer authorizes -> PI = requires_capture
  -> CheckoutSuccess?payment_intent=pi_...
  -> finalize-checkout (reviewer branch)
       verifyPayment (requires_capture counts as paid)
       insert orders payment_method='demo'  (no seller payout path)
       stripe.paymentIntents.cancel(pi)  -> void auth, release hold
       return ok
```

## Changes

### 1. Migration — re-seed reviewer shipping address (persistent)
New migration (data only, no new table, so no GRANT needed):
```sql
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'appreview@finditonflea.com';
  IF v_uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.buyer_addresses (user_id, first_name, last_name, address, suburb, state, postcode)
  VALUES (v_uid, 'App', 'Reviewer', '1 Apple Park Way', 'Sydney', 'NSW', '2000')
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
    address = EXCLUDED.address, suburb = EXCLUDED.suburb,
    state = EXCLUDED.state, postcode = EXCLUDED.postcode, updated_at = now();
END $$;
```
This unblocks the shipping gate so Apple Pay can run. `ON CONFLICT DO UPDATE` makes it idempotent and survives any future cleanup.

### 2. `supabase/functions/stripe-connect-payment-intent/index.ts` — reviewer branch
Replace the current demo short-circuit (lines 225-246) so it no longer returns `demo: true` and no longer inserts orders in the edge function. Instead:
- Compute the buyer total the same way as the normal path (items + bundle-adjusted shipping + secure checkout fee via `_shared/fees.ts`), reusing the existing bundle logic.
- Create a **platform-account** PaymentIntent (no `transfer_data`, no `on_behalf_of`, no `application_fee_amount`) with `capture_method: "manual"`, `currency: "aud"`, `automatic_payment_methods: { enabled: true }`, and `metadata: { is_apple_reviewer: "true", flea_buyer_id, item_ids }`.
- Return the normal PI response shape: `clientSecret`, `paymentIntentId`, `publishableKey`, `livemode: true`, `amount`, `sellerAccountId: null`, `clientStripeAccountId: null`. **No `demo` flag** — so the client proceeds into the real Apple Pay flow.
- Keep this branch **before** the seller-`stripe_account_id` requirement so a reviewer can check out even if a seller isn't connected (safety; not normally needed).

### 3. `supabase/functions/finalize-checkout/index.ts` — reviewer branch
Add a reviewer path (detect via `profiles.is_apple_reviewer` for `userId`, same lookup payment-intent uses). Place it right after `verifyPayment` (line ~562) so the `requires_capture` PI passes verification:
- Reuse the existing order-insert loop, but override `payment_method: "demo"` for the reviewer (so no real seller payout/transfer is ever attempted). `checkout_reference` stays the real `pi_…` id.
- Reuse existing listing-sold update + `createCheckoutNotifications`.
- After orders are inserted, **void the authorization**: `stripe.paymentIntents.cancel(checkoutReference, { cancellation_reason: "abandoned" })`. Best-effort (log on failure; the auth expires on its own otherwise).
- Return `{ ok: true }`.

### 4. `docs/apple-review-test-account.md` — update reviewer notes
Update the App Store Connect "Demo Account" / reviewer notes to state:
- The `@applereview` account ships with a pre-filled AU shipping address (1 Apple Park Way, Sydney NSW 2000), so checkout is not blocked.
- Apple Pay opens the **real** Apple Pay sheet with the correct AUD total. The authorization is voided immediately — no charge posts.
- Manual card checkout also works via the same reviewer path.

## Out of scope / noted limitations
- The reviewer's demo purchase marks the test seller's (`@sarahhearn` / `@jcsbhearn`) `[demo]` listings as sold, same as the existing demo bypass already does today. After review, re-run the seed migration (or manually re-list) to restore demo inventory. No behaviour change here.
- A temporary card authorization hold may appear on the reviewer's card and drop off within a few days. This is the unavoidable tradeoff of a real Apple Pay sheet and is standard for App Review.

## Verification
- After deploy: sign in as `@applereview`, add a sarah listing to cart, open checkout — shipping is pre-filled, Apple Pay button is enabled.
- Tap Apple Pay — the real sheet opens showing the correct AUD total. Authorize.
- Expect: success screen, an order created with `payment_method = 'demo'`, and the PaymentIntent cancelled (`status = canceled`) in Stripe — no capture, no transfer.
- Confirm no real charge on the test card (auth voided).

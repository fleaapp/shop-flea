## Root cause

`supabase/functions/stripe-connect-payment-intent/index.ts` (line 144) calls `stripe.accounts.retrieve(sellerStripeAccountId)` to check `charges_enabled` and pull the seller's display name before creating the PaymentIntent. The `STRIPE_SECRET_KEY` on Lovable Cloud is a **restricted key** (`rk_live_...`) that does not have the `accounts_kyc_basic_read` permission on connected accounts. The call throws `permission_denied`, the function returns 500, and the checkout sheet surfaces the raw Stripe error before any charge attempt — so Apple Pay, manual card, and saved card all fail the same way.

Same missing scope also breaks (or will silently degrade):
- `stripe-connect-checkout` (line 250)
- `stripe-config` (line 54, platform-account read)
- `stripe-connect-payout`, `stripe-connect-status`, `stripe-connect-dashboard`, `stripe-connect-add-bank`, `stripe-connect-upload-id`, `stripe-connect-onboard`, `admin-restore-seller`

## Fix (two parts)

### Part A — Grant the missing scopes on the restricted key (user action, one-time)

Only the user can edit the key in the Stripe dashboard. Required scopes on the restricted key used for `STRIPE_SECRET_KEY`:

- Connected accounts → **Basic business contact information** → Read + Write
- Connected accounts → **Account details** → Read + Write
- Connected accounts → **Bank accounts and cards** → Read + Write (needed by `add-bank`, `payout`)
- Connected accounts → **Persons** → Read + Write (onboarding)
- All Core resources already in use: Customers, PaymentIntents, Charges, Refunds, Balance, Payouts, Files, Products, Prices → Read + Write as applicable
- Webhook endpoints → Read (optional, for diagnostics)

Alternative: replace the restricted key with a full `sk_live_...` secret key via `update_stripe_secret_key`. Simplest, but broader blast radius if leaked.

I will present both options in chat and let you pick before doing anything.

### Part B — Make the payment path resilient so a scope gap never blocks checkout again

In `supabase/functions/stripe-connect-payment-intent/index.ts`:

1. Wrap the `stripe.accounts.retrieve` call in try/catch.
2. On `StripeAuthenticationError` / `StripePermissionError` (or any error where `code === 'account_invalid'` / status 403): log a warning to `error_logs`, skip the `charges_enabled` gate, and proceed. Set `sellerLabel = ""` so the description falls back to `"Flea order"`.
3. Any other error still rejects with the existing `seller_charges_disabled` response.

Rationale: `charges_enabled` is a nice-to-have preflight; Stripe will reject the PaymentIntent itself if the connected account truly can't accept charges, and the user will see a clean error from the actual charge attempt rather than a 500 from a metadata read.

Apply the same try/catch pattern to `stripe-connect-checkout` (line 250) for the parallel one-off checkout path.

Leave onboarding/status/payout/bank/upload-id functions alone — those legitimately require the scope, and the correct fix there is Part A. Admin dashboard will surface the raw error for those until scopes are granted.

### Part C — Surface permission errors clearly in admin error log

Add a helper in the shared edge-function code that detects Stripe permission errors and tags them with `code: 'stripe_key_scope_missing'` plus the missing scope name parsed from `error.message`. This makes future scope gaps obvious in `AdminErrorLogs` instead of appearing as generic 500s.

## Files touched

- `supabase/functions/stripe-connect-payment-intent/index.ts` — try/catch around `accounts.retrieve`, fallback label
- `supabase/functions/stripe-connect-checkout/index.ts` — same pattern
- `supabase/functions/_shared/stripeErrors.ts` (new) — small helper to classify + log permission errors

No frontend changes, no DB changes.

## Verification

1. Redeploy `stripe-connect-payment-intent` and `stripe-connect-checkout`.
2. From TestFlight (or preview if reproducible), retry manual card checkout — should proceed to the PaymentIntent confirmation step and either succeed or fail with a real card/charge error, not the scope error.
3. Retry Apple Pay — sheet should now present (assuming Xcode capability is correctly attached from the earlier fix); if it still fails, the failure will now be a genuine Apple Pay entitlement/provisioning issue, not a masked backend 500.
4. Check `AdminErrorLogs` for any `stripe_key_scope_missing` entries — those tell you which additional scopes to grant for onboarding/payout flows.

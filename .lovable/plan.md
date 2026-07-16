## Fix FREEFLEA coupon (Step 1 only)

**Root cause**: `validate-coupon` reads from the Lovable-managed database, but `stripe-connect-payment-intent` and `stripe-connect-checkout` read from the External database. FREEFLEA exists in one, not the other, so the coupon validates on the frontend but the payment functions never see it and charge the full fee anyway.

### Changes

1. **Seed `FREEFLEA` into the External `coupons` table** (via raw REST insert using `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`, per the project's persistence rule):
   - `code = 'FREEFLEA'`
   - `type = 'waive_buyer_fee'`
   - `active = true`
   - `expires_at = null`, `max_redemptions = null`

2. **Point `validate-coupon` at the External database** so validation and charging always read the same source of truth. Swap `SUPABASE_URL` / `SUPABASE_ANON_KEY` for `EXTERNAL_SUPABASE_URL` / `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` inside `supabase/functions/validate-coupon/index.ts`, then redeploy.

3. **Verify** by calling `validate-coupon` with `"FREEFLEA"` and confirming it returns `{ type: 'waive_buyer_fee' }`, then confirming the row is readable in External.

### Not doing this turn
- Bank descriptor change (you'll fix in Stripe Dashboard directly).
- MoR change (staying as seller-is-MoR).
- Refunding the $0.74 fee on your last test order (say the word and I'll do it after).
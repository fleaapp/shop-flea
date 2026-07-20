# Home feed missing listings after Cloud cutover

## Root cause (verified)

- `profiles` RLS on Cloud has only one SELECT policy: `auth.uid() = user_id`. Nobody can read anyone else's profile row.
- `public.profiles_public` was recreated with `WITH (security_invoker=on)`, so it inherits the caller's RLS. It returns 0 rows for other users too.
- `src/utils/fetchSellerProfiles.ts` treats a successful `profiles_public` query as authoritative (`canTrustMissing = true`).
- `src/hooks/useHomeFeed.ts` then drops every listing whose seller profile is missing → Sarah's active AU listing is stripped from @jcsbh's stack even though the `get_home_feed` RPC returns it.

Confirmed in the live DB: the listing exists (`active`, `region_id='AU'`), @jcsbh's `region_id='AU'`, no `discarded_listings` row, and `profiles_public` currently returns Sarah's row only when queried as a superuser.

## Fix

Migration:

1. Recreate `public.profiles_public` without `security_invoker` (i.e. default `SECURITY DEFINER`, owned by `postgres`) so it bypasses the base-table RLS. Column list stays exactly the same — it already excludes sensitive fields (email, stripe_account_id, paypal_merchant_id, negative_balance_cents, gst_alert timestamps, device_ids, report_strike_count, etc.).
2. `GRANT SELECT ON public.profiles_public TO authenticated, anon;` so both signed-in and guest home feeds can hydrate seller cards.
3. Leave the base `profiles` table policies untouched — direct queries to `profiles` from other users stay locked down.

No client changes needed. `fetchSellerProfiles` already prefers `profiles_public` and only falls back to `profiles` if the view errors.

## Verification

- Re-run the home feed as @jcsbh (via preview) and confirm Sarah's "Test" listing appears in the swipe stack.
- Query `profiles_public` from an authenticated session for a different user's `user_id` and confirm one row returns.
- Spot-check that direct `select * from profiles where user_id = '<other user>'` still returns 0 rows for a non-owner (base table RLS unchanged).

## Update memory

Add a project memory note that `profiles_public` MUST be `SECURITY DEFINER` (not `security_invoker`) because base-table `profiles` RLS is owner-only, so any future recreate of the view has to keep this or the feed breaks again.

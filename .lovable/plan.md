# Full app audit - pre-launch

Findings from a read-only sweep of the database, edge functions, error logs, database linter, security scanners and front-end code. Each item lists what I verified and what I propose to change.

## Launch blockers

**1. The marketplace is empty**
Verified: `listings` contains 12 rows - 8 `sold`, 4 `refunded`, **0 active**. The home feed will be blank for every new user on day one.
Fix: agree a seeding approach (your own listings, invited sellers, or a soft launch gate) and add an empty-feed state that invites listing instead of showing nothing.

**2. Apple review account cannot sell**
Verified: `stripe-connect-status` has a demo bypass that only triggers for accounts starting with `acct_demo_`, but the `@applereview` profile has `stripe_account_id = null` and `stripe_onboarding_complete = false`.
Fix: set the review profile's `stripe_account_id` to a synthetic `acct_demo_*` value so the reviewer can list, sell and reach checkout without hitting real Stripe onboarding.

**3. Test-mode auth settings still in place**
`auto_confirm_email` was switched on during smoke testing and email confirmation must be back on before launch. Leaked-password (HIBP) protection is not confirmed as enabled.
Fix: turn email confirmation back on, enable HIBP password checks, and re-test signup end to end.

**4. Test data still in production**
Verified: all 12 orders and 7 profiles are test/personal accounts, and 4 listings sit in `refunded`. Admin dashboards, transactions and error logs are showing smoke-test noise.
Fix: purge smoke-test orders, listings, notifications and error logs, keeping your real accounts and the Apple review account.

## Security

**5. 21 edge functions are missing from `supabase/config.toml`**
Verified: including `stripe-connect-payout`, `stripe-connect-payment-intent`, `stripe-connect-topup`, `stripe-connect-upload-id`, `validate-coupon`, `tracking-register`, `log-error`, `reload-schema`, `seed-push-vault-key`. I read each money-moving function and they all verify the JWT in code, so this is not currently exploitable - but the intent should be declared.
Fix: add explicit entries for all 21, and delete `reload-schema` and `seed-push-vault-key` (one-off maintenance functions that should not stay deployed).

**6. Database linter: 42 issues**
Verified: 4 tables with RLS enabled and no policy (`coupons`, `payment_events`, `rate_limits`, `saved_searches` - intentional, they are edge-function-only), 1 extension installed in `public`, and 37 `SECURITY DEFINER` functions executable by `anon` or `authenticated`.
Fix: revoke `EXECUTE` from `anon` on every internal function (email queue dispatch, `enqueue_email`, `move_to_dlq`, `seed_push_vault_key`, the `admin_*` family), keep only the functions the client genuinely calls, and move the public extension out of `public`.

## Reliability

**7. Refunds can fail with no fallback**
Verified in `error_logs`: `stripe-connect-refund` returned "Payment reference could not be found for this order". Orders missing `checkout_reference` cannot be refunded at all.
Fix: fall back to looking the charge up in `payment_events` by `order_id` before failing, and surface a clear admin-side manual refund path.

**8. Stale-chunk errors are still logged as errors**
Verified: 11 recent `Importing a module script failed` / `Load failed` entries across `/`, `/cart`, `/sales`, `/notifications`, `/admin`. `staleChunkRecovery` handles these, so they are recovered noise drowning out real errors.
Fix: classify recovered chunk failures as `warning`, and only escalate if the reload also fails.

**9. Two unconfirmed render crashes**
Verified: React error #310 (hook-order violation) logged on `/sales` and `/notifications`, most recently 28 Jul. I checked both files and found no obvious conditional hook, so this may already be fixed.
Fix: reproduce both routes in the browser with real data and either confirm resolved or trace the offending hook.

## Polish

**10. Accessibility**: 8+ `<img>` elements have no `alt` (Notifications, EditProfile, WishlistCard, OrderSuccessDialog, ForgotPassword, ResetPassword, VerifyEmail, RegionBlockedScreen). `Auth.tsx` still uses `h-screen` instead of `h-dvh`.

**11. Bundle**: 73 runtime dependencies. Worth a dependency and chunk review before launch, since stale-chunk reload errors are already the most common client error.

## Suggested order

1. Blockers 1-4 (data, Apple review account, auth settings).
2. Security 5-6.
3. Reliability 7-9.
4. Polish 10-11.

Tell me if you want all four phases in one pass, or blockers only first.

Ships all four deferred items. Revised per your note: buyer-confirmed untracked deliveries still move to `delivered` — they just don't auto-complete/release funds until admin approves.

## 1. Linter fixes

- **RLS enabled, no policy** (3 tables like `rate_limits`, `payment_events`, `saved_searches`): add explicit deny/service-role-only policies documenting intent.
- **Public bucket allows listing**: tighten `storage.objects` SELECT policies on public buckets to per-object read only, no list.
- **Public can execute SECURITY DEFINER function**: `REVOKE EXECUTE ... FROM anon` on auth-required functions (`mark_order_delivered`, `request_refund`, `complete_order`, `mark_order_shipped`, `mark_support_thread_read`, `mark_order_thread_read`, `admin_*`, `seed_push_vault_key`, `check_and_record_rate_limit`, `create_mention_notifications`, `increment_brand_usage`). Keep `authenticated`/`service_role`.
- **Permissive RLS policy** (`USING (true)` on non-SELECT): scope to intended role.
- Skip: `extension in public` (disruptive), Postgres upgrade, INFO-only items.

## 2. Admin gate for buyer-confirmed untracked deliveries

Behavior:

- Tracked orders: buyer taps "Delivered" → moves to `delivered`, 48h dispute window starts, funds release after → completion. Unchanged.
- Untracked orders: buyer taps "Delivered" → **moves to `delivered`** (visible everywhere as delivered), but flagged `pending_admin_delivery_review = true`. Auto-complete cron skips these. Admin sees an "Untracked deliveries" tab in Approvals.
  - Admin approves → clears flag, 48h dispute window starts from approval time, funds release normally.
  - Admin rejects → reverts to `awaiting`, notifies buyer + seller.

Changes:

- Migration: add `pending_admin_delivery_review boolean not null default false` on `orders`. Update `mark_order_delivered` to set the flag when `p_source='buyer'` AND `tracking_number IS NULL`. Update auto-complete + payout-release logic to skip flagged rows.
- New RPCs: `admin_approve_untracked_delivery(order_id)`, `admin_reject_untracked_delivery(order_id, reason)`.
- Client: new tab in `AdminApprovals.tsx`; update `useAdminApprovals` hook.

## 3. Stripe reconciliation

- New edge function `stripe-reconciliation`:
  - Every `orders.refunded_at` in last 7 days must have a matching `refund.created` entry in `payment_events`; missing rows log to `error_logs` (source `reconciliation`, severity `high`).
  - Reverse: every Stripe refund in the last 7 days must map to an `orders` row.
- Schedule via `pg_cron` daily 08:00 UTC (via `supabase--insert`, since it contains project ref + anon key).
- Filter view in `AdminErrorLogs.tsx` for `source='reconciliation'`.

## 4. Shared edge function logger

- `supabase/functions/_shared/logger.ts` → `logError({ source, severity, title, message, stack, context })`, best-effort insert into `error_logs` via service role client. Never throws.
- Retrofit catches in: `finalize-checkout`, `stripe-connect-payment-intent`, `stripe-webhook`, `send-push-notification`, `order-messages`, `stripe-reconciliation`.

## Order of execution

1. Migration (linter + admin flag + RPC updates).
2. Shared logger + reconciliation edge function.
3. `AdminApprovals.tsx` new tab + retrofit catches.
4. Cron via `supabase--insert`.
5. Re-run linter; sanity-check.

## Technical notes

- No user-facing copy change on the buyer side — order still shows "Delivered".
- Seller sees "Delivered — pending review" chip only in Sales details while flagged.
- Force-complete via existing admin refund tools remains available.

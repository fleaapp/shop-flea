## Fixes for Refund + Tracking-Approval System

Address the 4 gaps identified in the audit, ordered by money-at-risk.

### 1. Payout guard: hold funds through delivery + dispute window

File: `supabase/functions/stripe-connect-payout/index.ts`

Expand the "held funds" query so available balance excludes any order whose funds aren't yet released:
- `status = 'awaiting'` (already excluded)
- `status = 'shipped'` (tracking may still be rejected)
- `status = 'delivered'` AND `now() < dispute_window_ends_at` (buyer can still refund)
- Any order with `refund_requested_at IS NOT NULL AND refunded_at IS NULL AND refund_declined_at IS NULL` (pending refund)

Only orders in `completed` (released) or truly finalized should count toward payout.

### 2. Schedule `auto-approve-refund-requests` cron

New migration adds a pg_cron entry (via `supabase--insert`, not migration, since it embeds the project URL + anon key per project rules) running hourly:

```
select cron.schedule(
  'flea-auto-approve-refunds',
  '0 * * * *',
  $$ select net.http_post(
       url:='https://<project>.supabase.co/functions/v1/auto-approve-refund-requests',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
```

Verify `pg_cron` + `pg_net` are enabled (they are, per existing `flea-auto-order-progress` job).

### 3. Fix `admin_dismiss_refund_dispute` precedence bug

Migration recreates the function with parenthesized WHERE:

```sql
WHERE (id = p_order_id OR (v_group IS NOT NULL AND order_group_id = v_group))
  AND refunded_at IS NULL
```

So `refunded_at IS NULL` applies to both branches and can't clear an already-refunded row.

### 4. Admin badge for pending approvals

- `src/hooks/useAdminBadges.ts`: add a count query for pending tracking reviews + pending delivery reviews + open disputes (same filters `useAdminApprovals` uses).
- Surface count on the "Approvals" menu row in `AdminDashboard.tsx` using the existing badge style.
- Realtime subscription on `orders` (filter: rows entering `shipped` or refund-request states) to refresh count without polling.

### Verification

- `tsgo` typecheck + production build.
- Manual: create a test order, mark shipped, attempt instant payout → should show reduced available balance.
- Confirm cron entry exists: `select jobname from cron.job where jobname = 'flea-auto-approve-refunds'`.
- Force a refund request older than 72h via SQL, wait for cron (or manually invoke edge fn) → status flips to refunded.

### Out of scope

- AfterShip / automated delivery detection (still manual per prior decision).
- Verifying live cron execution health (needs runtime access).

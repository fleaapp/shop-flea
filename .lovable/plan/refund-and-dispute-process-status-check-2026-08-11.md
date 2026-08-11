# Refund and dispute process - status check

## What is confirmed in place

Verified directly against the database and the code:

- Database functions exist and reference the return flow: `request_refund`, `respond_to_refund_request`, `admin_require_return`, `close_stale_returns`, `escalate_lapsed_refund_requests`, `submit_return_tracking`, `admin_dismiss_refund_dispute`.
- The hourly `auto-approve-refund-requests` job runs and calls both `escalate_lapsed_refund_requests` (14-day seller lapse into the admin queue) and `close_stale_returns` (buyer misses the 5-day posting window).
- `return-register` edge function exists for buyer return tracking, and `applyTracking.ts` fires `stripe-connect-refund` automatically when a return parcel scans as delivered.
- Buyer and seller both see `RefundStatusRow` inside the order and sale detail sheets, including the "Add return tracking" action.
- Tracking sync and webhook jobs are scheduled and active.

So the flow is wired end to end. Two things are worth tidying and one thing is worth actually exercising before launch.

## Proposed work

### 1. Remove the duplicate refund cron job
There are two active jobs pointing at `auto-approve-refund-requests`: `auto-approve-refund-requests-hourly` (:00) and `flea-auto-approve-refunds` (:30). They do the same work twice an hour. Unschedule one, keep the hourly one.

### 2. Pin `return-register` auth behaviour
`return-register` has no entry in `supabase/config.toml`, so it inherits JWT verification. That is the correct setting for a buyer-initiated call - add the explicit entry so it cannot drift.

### 3. Live end-to-end rehearsal on a test order
Walk one order through each branch and confirm state, notifications and money:

- Return path: request refund (not as described) -> seller approves -> return required -> buyer adds tracking -> 17track delivered scan -> refund issued, both parties notified.
- Direct path: item never arrived -> refund straight away, no return leg.
- Seller declines -> order appears in the admin Dispute queue with the three outcomes (require return, refund without return, dismiss) plus the seller-at-fault toggle.
- Seller silent 14 days -> escalation into the same queue, no silent auto-refund.
- Buyer misses the 5-day return posting deadline -> request closes, seller keeps payment, funds release.

### Technical notes

- Cron change is a single `cron.unschedule('flea-auto-approve-refunds')` migration.
- Config change is a two-line addition to `supabase/config.toml`.
- The rehearsal needs a test order that can be pushed through delivered state; the 14-day and 5-day clocks can be simulated by back-dating `refund_request_deadline_at` / `return_deadline_at` on the test row only.

# Refund workflow — finish the 72h loop

Skipping the buyer-side "accept refund" banner. Sellers can refund unilaterally (existing seller confirm dialog is enough).

## 1. Admin dispute queue (declined refunds)

The `Dispute` tab in `/admin/approvals` currently just lists delivered orders. Rewire it to show refund requests the seller has declined so an admin can arbitrate.

- `src/hooks/admin/useAdminApprovals.ts`
  - Expand `BASE_SELECT` with `refund_requested_at, refund_requested_by, refund_request_reason, refund_request_deadline_at, refund_declined_at, refund_declined_reason`.
  - `kind === 'dispute'` query becomes: `refund_declined_at IS NOT NULL AND refunded_at IS NULL AND status IN ('delivered','shipped')`.
  - Add two mutations:
    - `forceRefund(orderId)` calls existing `stripe-connect-refund` edge function with `{ order_id, reason: 'admin_dispute' }`.
    - `dismissDispute(orderId)` calls a new `admin_dismiss_refund_dispute` RPC that clears `refund_requested_at / deadline / declined_*` and leaves the sale intact.
- `src/pages/admin/AdminApprovals.tsx`
  - In the dispute branch, show buyer reason, seller decline reason, timestamps, and two buttons: `Refund buyer` / `Dismiss (side with seller)`.
- New migration: `admin_dismiss_refund_dispute(p_order_id uuid)` — SECURITY DEFINER, requires `has_role(auth.uid(),'admin')`, nulls the refund-request columns on the order (and its group siblings if `order_group_id`).

## 2. Daily cron: auto-approve refunds after 72 hours

New edge function `supabase/functions/auto-approve-refund-requests/index.ts` (verify_jwt=false, service role):

- Select orders where `refund_requested_at IS NOT NULL AND refund_request_deadline_at < now() AND refund_declined_at IS NULL AND refunded_at IS NULL`.
- For each, invoke the same refund path used by seller-approve in `stripe-connect-refund` (reason `auto_approved_72h`), then mark order/group as refunded via the existing pipeline.
- Rate-limit + log via `error_logs` on failure so it retries next run.
- Register in `supabase/config.toml` with `verify_jwt = false`.
- Schedule via `pg_cron` + `pg_net` running hourly (`0 * * * *`) — hourly, not daily, so the 72h SLA doesn't slip by up to 24h. Scheduled through the insert tool (contains project URL + anon key), not the migration tool.

## 3. FAQ and Terms copy — 72h window

- `src/components/FAQSection.tsx`
  - Update the "Can I get a refund?" answer to explain: buyer requests through order chat within 10 days of delivery, seller has 72 hours to approve or decline, and if no response the refund is issued automatically. Declined requests go to Flea for review.
- `src/pages/Terms.tsx` (Section 10 / refunds)
  - Add a sentence: "Once a buyer submits a refund request, the seller has 72 hours to approve or decline. If the seller does not respond within 72 hours, Flea will automatically issue the refund. Declined requests are reviewed by Flea and may still be refunded at our discretion."
- Use short dashes only, no em dashes.

## Technical notes

- Existing schema already has all needed columns (`refund_requested_at`, `refund_request_deadline_at`, `refund_declined_at`, `refund_declined_reason`) from migration `20260725060335`.
- `respond_to_refund_request` RPC exists for seller approve/decline — reused unchanged.
- `stripe-connect-refund` edge function is the single source of truth for issuing the Stripe refund and updating order status; both the cron and the admin `Force refund` action call it.
- Admin RLS on `orders` already lets admins read all rows (added in the earlier approvals work), so the dispute list needs no extra policy.

## Out of scope

- Buyer-facing banner for seller-initiated refunds (per your call).
- Changes to seller `SalesDetailsSheet` approve/decline flow (already shipped).

## Goal
Allow a buyer to mark an order as delivered even when the seller hasn't entered shipping/tracking yet. The order should jump straight from `awaiting` → `delivered` (skipping the `shipped` step), starting the normal 48h dispute window.

## Current state (verified)
- The UI in `src/components/OrderDetailsSheet.tsx` already shows the "Mark as delivered" button when `effectiveStatus === 'awaiting' || 'shipped'`, with a confirmation dialog for the awaiting case. So the UI path already exists.
- The blocker is the DB RPC `public.mark_order_delivered` (migration `20260725052413_...sql`), whose `UPDATE` filters `WHERE o.status = 'shipped'`. A buyer call on an `awaiting` order silently updates 0 rows, and the order stays put.

## Change

Add a new migration that replaces `public.mark_order_delivered(p_order_id, p_order_group_id, p_source)` so it also accepts orders currently in `awaiting`:

- Widen the status filter to `o.status IN ('awaiting', 'shipped')`.
- When transitioning from `awaiting`, backfill `shipped_at = COALESCE(o.shipped_at, now())` so the shipping tracker and downstream logic (payout eligibility, receipts) still have a shipped timestamp.
- Keep all other behaviour identical: `delivered_at` set, `dispute_window_ends_at = now() + 2 days`, `admin_marked_delivered` only flipped when `p_source = 'admin'`, buyer/admin auth check unchanged, `SECURITY DEFINER` + `search_path` unchanged, same grants.

No frontend changes required — `useOrders.markAsDelivered` and the OrderDetailsSheet button already handle both statuses; the confirmation dialog copy for the awaiting case is already in place.

## Out of scope
- No change to `complete_order` (already accepts `shipped`/`delivered`).
- No change to admin approval flows or seller-side tracking gates.
- No change to notifications — the existing "order delivered" push already fires from `markAsDelivered`.

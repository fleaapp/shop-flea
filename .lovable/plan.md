
## Formalize buyer/seller refund approvals + split Delivered from Completed

Currently: seller can issue an instant refund from Sale Details; buyer's refund request only creates a chat message + attachments and relies on the seller noticing or admin stepping in. There is no tracked "pending refund request" state, no 72h timer, and no seller Approve/Decline UI on the request itself. This plan makes that flow explicit and adds the 4-tab split you asked for.

### 1. Sales / Cart 4-tab split (both pages)

Toggles become: **Ordered | Shipped | Delivered | Completed**

- `awaiting` → Ordered
- `shipped` → Shipped
- `delivered` → Delivered (in the 48h buyer-protection window, or held because a refund request is open)
- `completed` → Completed
- `refunded` → Completed (sub-badge "Refunded")

### 2. Refund approval state machine

New order columns:
- `refund_requested_at` (timestamptz)
- `refund_requested_by` (uuid, buyer or seller)
- `refund_request_reason` (text)
- `refund_request_deadline_at` (timestamptz, +72h from request)
- `refund_declined_at`, `refund_declined_reason`

Flows:

**Buyer requests refund** (existing RefundRequestDialog with photos/video):
1. Sets `refund_requested_at = now()`, `refund_requested_by = buyer_id`, deadline `now() + 72h`.
2. Order stays `delivered` (locks it out of auto-complete).
3. Seller sees an **Approve refund** / **Decline** pair on Sale Details.
   - **Approve** → calls existing `stripe-connect-refund` → status `refunded`.
   - **Decline** → sets `refund_declined_at` + reason, escalates to admin dispute queue.
4. If seller does nothing for 72h → cron auto-approves the refund (funds returned to buyer, no seller negative).

**Seller offers refund** (existing "Refund sale" button, changed to an offer):
1. Sets `refund_requested_at = now()`, `refund_requested_by = seller_id`, deadline `now() + 72h`.
2. Buyer sees **Accept refund** on Order Details.
   - **Accept** → `stripe-connect-refund` → `refunded`.
3. If buyer doesn't act for 72h → auto-accept (funds returned).

**Admin disputes queue** (existing AdminApprovals "Dispute" tab): now shows declined refund requests so admin can adjudicate.

Copy note: 72h is well within Australian Consumer Law "reasonable time" expectations for a marketplace intermediary - no statutory number is set, so 72h is defensible and matches Vinted/Depop norms.

### 3. Auto-refund cron

Extend the existing `auto-refund-unshipped` (or add sibling `auto-approve-refund-requests`) to run daily and finalize any request where `refund_request_deadline_at < now()` and no decision has been made.

### 4. UI touch-ups

- **OrderDetailsSheet.tsx** (buyer view): if `refund_requested_by = seller`, show yellow banner "Seller offered a refund - Accept / Decline" + countdown; if `refund_requested_by = buyer` and pending, show "Waiting for seller (72h)".
- **SalesDetailsSheet.tsx** (seller view): if `refund_requested_by = buyer` and pending, show "Buyer requested a refund" with Approve / Decline; if seller-initiated pending, show "Waiting for buyer".
- **Notifications**: `refund_requested`, `refund_offered`, `refund_approved`, `refund_declined`, `refund_auto_approved` types with existing emoji/full-stop conventions.

### 5. Files touched

- Migration: add 5 columns + indexes + `request_refund` / `respond_to_refund_request` RPCs.
- `supabase/functions/stripe-connect-refund/index.ts` - branch on requestor.
- New: `supabase/functions/auto-approve-refund-requests/index.ts` + pg_cron entry.
- `src/pages/Sales.tsx`, `src/pages/Cart.tsx` - 4-tab split + status filter mapping.
- `src/components/OrderDetailsSheet.tsx`, `src/components/SalesDetailsSheet.tsx` - approval banners + buttons.
- `src/components/RefundRequestDialog.tsx` - call new RPC instead of chat-only submit.
- `src/hooks/useOrders.ts` - expose new fields + `respondToRefund` mutation.
- `src/pages/admin/AdminApprovals.tsx`, `src/hooks/admin/useAdminApprovals.ts` - dispute tab reads declined requests.
- `src/components/FAQSection.tsx`, `src/pages/Terms.tsx` - refund clause updated to reference 72h approval window.

### Technical section

- The `stripe-connect-refund` function already handles the payout reversal + application fee return, so no Stripe-side changes needed - the new RPCs just gate who can trigger it and record the request lifecycle.
- Cron: `select cron.schedule('auto-approve-refunds', '0 * * * *', ...)` hourly is sufficient given 72h window.
- All new columns default null so existing orders unaffected. RLS: buyer can UPDATE `refund_requested_*` when `buyer_id = auth.uid()` and status = 'delivered'; seller mirror. Admin can override via existing has_role.
- Copy uses short dashes only.

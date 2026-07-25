# Vinted-style Buyer Protection with Manual Admin Approval

Replace the current auto-release payout model with a manually gated flow. Funds are only released after admin approves tracking, delivery is confirmed (by buyer, admin, or 10-day fallback), and a 2-day buyer dispute window elapses. Copy uses short dashes (-) only, never em dashes.

## New order lifecycle

```text
awaiting -> shipped (seller inputs tracking)
        -> tracking_approved (admin verifies tracking is real/valid)
        -> delivered (buyer taps, OR admin marks, OR 10-day fallback)
        -> completed (buyer confirms after delivery, OR 2-day auto-complete)
                     -> funds released to seller balance
        -> refunded (buyer reports issue within 2 days, admin resolves)
```

## Changes

### 1. Database (orders table)
- Add `tracking_approved_at`, `tracking_approved_by` (admin uuid), `tracking_rejected_count` (int), `admin_marked_delivered` (bool), `completed_at`, `dispute_window_ends_at`.
- Add `profiles.wrong_tracking_count` (int) and `profiles.tracking_flagged` (bool). At 3 rejected tracking submissions, seller is auto-flagged for admin review and blocked from listing until cleared.

### 2. Seller flow
- Seller ships and inputs tracking as today.
- Status becomes `shipped` but funds stay locked (not eligible for payout) until `tracking_approved_at` is set.
- If admin rejects tracking, `tracking_rejected_count` increments; seller gets a notification to re-submit. At 3, seller is flagged.

### 3. Admin flow (new admin section: "Tracking review")
- Queue of `shipped` orders where `tracking_approved_at IS NULL`.
- Admin sees tracking number + carrier link, can Approve or Reject (with reason).
- Admin can also mark an order as Delivered manually (sets `admin_marked_delivered = true`, status -> `delivered`).

### 4. Buyer flow (Order details drawer)
- Delivered button behaviour:
  - If `admin_marked_delivered = true` and buyer hasn't confirmed: button label is **Complete** (not Delivered).
  - Otherwise: button label is **Delivered**.
- Tapping the button opens a confirmation dialog with two actions:
  - **Confirm complete** -> sets status `completed`, releases funds.
  - **Report issue / Request refund** -> opens existing RefundRequestDialog.
- After delivery is confirmed (by any path), buyer has a 2-day dispute window. If no action, order auto-completes and funds release.

### 5. Payout gating (stripe-connect-payout)
- Replace current "awaiting shipment" gate with: block funds tied to orders where `status != 'completed'` OR `completed_at > now() - interval '0 seconds'` (i.e. only completed orders count toward available balance).
- Sellers never go negative: refunds can only happen on orders still in the locked pool.

### 6. UI label swap ("Refunded" -> "Completed")
- Sales page toggle: `Ordered | Shipped | Completed` (was `... | Delivered | Refunded`).
- Cart/Orders page toggle: same rename.
- Refunded orders appear under Completed as a sub-state (grey badge "Refunded").

### 7. 10-day fallback
- Existing cron: if `shipped` + `tracking_approved` + 10 days elapsed with no delivery confirmation, auto-mark `delivered` (opens buyer's 2-day dispute window).
- After 2 more days with no dispute: auto `completed`, funds released.

### 8. Copy rules
- All new/edited strings use short dash `-` only. No em dashes anywhere in new copy.

## Technical section

- Migration: add columns to `orders` and `profiles`; add `notify_on_tracking_action` trigger for seller notifications; add admin RLS policy for tracking approval fields.
- Edge functions:
  - New: `admin-tracking-review` (approve/reject).
  - Update: `stripe-connect-payout` (new gate query).
  - Update: `mark_order_delivered` RPC (accept `source` = buyer|admin|auto; set `admin_marked_delivered` appropriately).
  - New cron branch in shipping-reminders (or new function): auto-complete after 2-day dispute window.
- Frontend:
  - `OrderDetailsSheet.tsx` - dynamic Delivered/Complete button + confirm dialog with two options.
  - `Sales.tsx`, `Cart.tsx` - rename toggle to `Completed`, group refunded under it.
  - `SellerDashboard.tsx` - "Pending" now includes shipped + delivered awaiting completion; copy update.
  - New admin page `src/pages/admin/AdminTrackingReview.tsx` + hook + entry in AdminDashboard "Moderation" group.
  - Seller flagged state: block listing creation when `profiles.tracking_flagged = true`, surface banner.

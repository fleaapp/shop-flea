## Problem
The app still enforces a legacy 10-day refund deadline alongside the new Vinted-style 48-hour post-delivery window. This is duplicative and confusing under the current lifecycle where funds are held for 48 hours after delivery.

## Goal
- Buyers can only request a refund while the order is `delivered` and within 48 hours of delivery.
- Once the order moves to `completed` (buyer confirms, 48h passes, or admin marks delivered), the buyer refund path closes.
- Admins retain an escape-hatch override to force-refund completed orders from the dispute queue.
- FAQ and Terms copy is updated to remove "10 days" and describe the 48-hour window.

## Plan

### 1. Database / RPC changes
- Update the `request_refund` RPC to reject refund requests unless:
  - `order.status = 'delivered'`
  - `now() <= order.delivered_at + interval '48 hours'`
- Keep the existing `respond_to_refund_request` RPC (seller 72h response window) unchanged.
- Keep the existing admin `forceRefund` path and `admin_dismiss_refund_dispute` RPC unchanged.

### 2. UI gating
- Update `OrderDetailsSheet.tsx` so the "Report issue / Request refund" button only appears when:
  - Order status is `delivered`
  - `delivered_at` is within the last 48 hours
- Once the order is `completed`, show a completed state instead of the refund CTA.

### 3. Copy updates
- Update `src/components/FAQSection.tsx`: replace any "10 days" refund language with "within 48 hours of delivery."
- Update `src/pages/Terms.tsx` Section 10 (or relevant refund section) to describe the 48-hour buyer window and the admin arbitration override.
- Use short dashes (`-`) only, no em dashes.

### 4. Verification
- Run typecheck/build to ensure no broken references.
- Verify the `request_refund` RPC returns a clear error when the 48-hour window has passed.
- Confirm the FAQ and Terms render the updated copy.

## Out of scope
- No changes to the 72-hour seller response window.
- No changes to the auto-approve cron or admin dispute queue UI (already implemented).
- No changes to delivery/tracking approval flow.
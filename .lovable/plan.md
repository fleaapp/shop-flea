# Dispute and refund hardening - launch prioritisation

## Short answer

No - not all of it needs to be fixed before launch. The current escrow / refund system is already sound and, in one area, stronger than the previous audit suggested. The right approach is a **phased fix**: plug the two real pre-launch risks, then build the rest in the first weeks after go-live.

## What Flea does today (corrected from the earlier audit)

- Funds are held in escrow until delivery + a 48h dispute window passes.
- Refund requests require live camera/video proof and a reason.
- Sellers have 72h to approve or decline. No response triggers an automatic refund.
- Seller declines land in the admin Dispute queue where you can force-refund or dismiss.
- Never-shipped orders are auto-refunded after 8 days.
- **Chargebacks are already handled** in `stripe-webhook` (`charge.dispute.created`, `funds_withdrawn`, `closed`). The order is marked `disputed_at`, the seller is notified, and the seller balance is re-synced. The gap is that payouts are not explicitly frozen during an open dispute - but the negative-balance guard already blocks the device/account once the balance turns negative.

## Real gaps, ranked by launch risk

### Must fix before launch

1. **Evidence-gated auto-approval (HIGH risk)**  
   Today, if a seller does not respond within 72h, the buyer is refunded automatically with no review of the photo/video evidence. A slow, travelling, or unaware seller can lose the full sale value with no human check. This is the biggest fairness and abuse risk.

2. **Dispute status visibility (HIGH risk)**  
   Once a refund request is declined and reaches the admin queue, neither buyer nor seller sees an "under review" state or a deadline. Both parties are left guessing, which drives support messages and erodes trust.

### Important, but safe to ship without

3. **Seller counter-evidence** - Decline is currently text-only. Letting sellers attach photos would reduce admin burden and improve fairness, but text is workable at low volume.
4. **Partial refunds** - Useful for minor faults, but all-or-nothing refunds are acceptable for an MVP marketplace.
5. **Return-required resolution** - Vinted-style "return the item before refund" is the fairest long-term model, but it requires tracked-return plumbing that can be added post-launch.
6. **Buyer refund-rate counter / abuse tracking** - Important as volume scales, but not needed for day one.

### Already covered, minor hardening only

7. **Chargeback handling** - The webhook already reacts to Stripe disputes. The only missing piece is an explicit payout freeze while a dispute is open.

## Proposed work

### Phase 1 - Pre-launch (this build)

1. **Route unanswered refund requests to admin review instead of auto-refunding.**
   - Change `auto-approve-refund-requests` so that, when the 72h deadline passes, it sets the order to an `admin_review` status and notifies the admin queue, rather than calling `stripe-connect-refund` immediately.
   - Add a 24h admin SLA; if the admin has not acted after 24h, only then auto-refund.
   - Add a small migration for `orders.admin_review_at` and update the dispute tab query to include `admin_review` rows.

2. **Show a clear "under review" state to both parties.**
   - Add a `RefundStatusRow` to the buyer's order details and the seller's sale details when `refund_declined_at` or `admin_review_at` is set.
   - Copy: "Your refund request is being reviewed by Flea. We'll let you know within 24 hours."
   - Send a push/alert to both parties when the status changes to `admin_review`, `refunded`, or `dispute_dismissed`.

3. **Harden chargeback payout freeze.**
   - In `stripe-webhook`, when `charge.dispute.created` / `funds_withdrawn` fires, set the seller's `payout_review_flag = true` and `payout_review_reason = 'Open payment dispute'` so the dashboard blocks manual payouts until `charge.dispute.closed` clears it.

### Phase 2 - First month post-launch

4. **Seller counter-evidence on decline.**
   - Allow photo/video capture when a seller declines a refund request.
   - Store via the existing `order-attachments` pattern and show buyer + seller evidence side-by-side in the admin dispute row.

5. **Partial refund support.**
   - Add `orders.refund_amount` (default full amount).
   - Update `stripe-connect-refund` to accept an optional `amount` and pass it to Stripe's `refund.create`.
   - Add an admin input field in the dispute row for the refund amount.

### Phase 3 - Later

6. **Return-required resolution.**
   - Add `orders.return_required_at`, `return_tracking_provider`, `return_tracking_number`.
   - Admin can choose "Refund on return" outcome; buyer uploads a return tracking number; refund is released when 17track reports the return as delivered.

7. **Buyer refund-rate counter and admin flag.**
   - Add `profiles.refund_request_count` incremented in `request_refund`.
   - Surface a badge in the admin dispute row when a buyer has >2 refund requests in 90 days.

## Why this ordering

Phase 1 fixes the two defects that can actively hurt sellers and create support load on day one. Everything else improves fairness and reduces manual work, but the current system already collects evidence, holds funds in escrow, reverses transfers, and routes disputes to you. Launch is reasonable once Phase 1 is in place.

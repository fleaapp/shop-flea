# Dispute and refund hardening

## What Flea does today (verified in code)

Buyer protection is escrow-style: money is held and only released after delivery plus a dispute window.

- Funds release: delivery is stamped by 17track carrier scan (or admin approval for untracked), which opens a 48h dispute window. Orders auto-complete and pay out after that window (`auto_complete_delivered_orders`).
- Refund request (`request_refund`): allowed within 48h of delivery, or any time once an order has been in transit 10+ days with no delivery (lost parcel). Reason capped at 500 chars. Refund requests require live camera/video proof in the app.
- Seller response (`respond_to_refund_request`): 72h to approve or decline. Approve triggers `stripe-connect-refund`.
- No response in 72h: `auto-approve-refund-requests` cron refunds the buyer automatically, with `reverse_transfer` and `refund_application_fee` so the seller's balance and the platform fee are both clawed back.
- Seller declines: the order enters the admin dispute queue (`useAdminApprovals` kind `dispute`), where an admin can force a refund or dismiss.
- Never shipped: `auto-refund-unshipped` refunds in full 8 days after purchase.
- Orphan charges: `reconcile-orphan-payments` refunds any successful payment with no order row.

## How this compares

- Vinted: Buyer Protection fee, 2 days after delivery to report an issue, evidence photos required, funds held in escrow, Vinted arbitrates and can order a tracked return before refunding. Flea matches this shape closely.
- Depop: buyer has up to 30 days (Depop Payments / PayPal rails), disputes are pushed to the payment provider, sellers can lose chargebacks months later.

Flea sits closer to Vinted, which is the right model for a small AU marketplace. The core money mechanics are sound: escrow, reverse transfers, fee clawback, idempotency, cron safety nets.

## Real gaps

1. No return leg. Every resolution is refund-or-nothing, so a buyer who wins a "not as described" dispute keeps both the item and the money. Vinted requires a tracked return for most non-fraud cases.
2. No partial refunds. Minor faults force an all-or-nothing outcome, which pushes sellers to decline and admins to arbitrate.
3. Auto-approve at 72h has no evidence gate. A seller who is asleep, travelling, or slow loses the full sale value with no review, and the buyer's photo proof is never checked by anyone.
4. Sellers cannot submit counter-evidence. Decline is just a 500 char text field; admins arbitrate with buyer photos only.
5. No dispute SLA or status visibility. Once a dispute reaches the admin queue there is no deadline, no buyer/seller-facing "under review" state, and no notification cadence.
6. No abuse tracking. Nothing counts refund requests per buyer, so serial claimants are invisible.
7. Chargebacks are unhandled. There is no `charge.dispute.created` handler in `stripe-webhook`, so a card chargeback after payout leaves Flea absorbing the loss silently.

## Proposed work (in priority order)

1. Chargeback handling: add `charge.dispute.created` / `closed` to `stripe-webhook`, mark the order disputed, freeze the seller's payout, notify admin.
2. Evidence-gated auto-approval: instead of silent auto-refund at 72h, route unanswered requests into the admin queue with a 24h SLA, auto-refunding only if admin does not act.
3. Seller counter-evidence: allow photos on decline, shown side by side with buyer proof in the admin dispute view.
4. Partial refund support in `stripe-connect-refund` plus an admin amount field.
5. Return-required resolution: an admin outcome that asks the buyer for tracked return, refunding on carrier delivery scan.
6. Buyer refund-rate counter on the profile, surfaced to admins and used to flag serial claimants.
7. Dispute status surfaced to both parties with deadline copy, plus reminder notifications.

## Technical notes

- Items 1, 2, 4 are edge function and cron changes plus small migrations (`orders.disputed_at` already exists; add `refund_amount`, `return_required_at`, `return_tracking_number`).
- Item 3 reuses the existing order-attachments storage hierarchy and the compressed base64 to edge function pattern.
- Item 6 is a counter column on `profiles` incremented in `request_refund`.

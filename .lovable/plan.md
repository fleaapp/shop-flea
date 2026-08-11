# Vinted-style dispute and refund process

Move Flea from "refund or nothing" to Vinted's model: the buyer must return the item before a "not as described" refund is paid, and the seller gets 14 days to respond.

## Current behaviour (verified in the database and edge functions)

- Buyer can request a refund within 48h of delivery, or any time after 10 days in transit with no delivery (lost parcel). Live camera/video proof required.
- Seller has 72h to approve or decline (`refund_request_deadline_at`).
- No seller response in 72h: `auto-approve-refund-requests` refunds the buyer automatically.
- Seller declines: the order lands in the admin Dispute queue, where the admin can force a refund or dismiss.
- `auto_complete_delivered_orders` already holds funds while a refund request is open.
- There is no return leg anywhere - a buyer who wins keeps the item and the money.

## Target behaviour

```text
Delivered -> buyer has 48h to report an issue (unchanged)
   |
   v
Refund requested (photo/video proof)
   |
   +-- Seller approves  -> return required -> refund on return delivery
   +-- Seller declines  -> admin dispute   -> admin picks outcome
   +-- No response 14d  -> admin dispute   -> admin picks outcome
```

### Refund reasons split into two paths

- **Return required** (item not as described, wrong item, damaged, quality not as expected): the buyer must post the item back with tracked AU postage before any money moves.
- **No return** (item never arrived / lost parcel): refunded directly, exactly as today. There is nothing to send back.

### Seller response window

- The 72h deadline becomes **14 days**.
- Reminder notifications to the seller at day 7, day 12 and day 13.
- If the 14 days lapse with no response, the order goes to the **admin Dispute queue** rather than auto-refunding. The admin then decides: order a return, refund outright, or dismiss.

### Return flow

1. Once a return is required, the buyer gets 5 days to post the item and enter a tracking number, using the existing AU carrier picker and validation.
2. If the buyer does not enter tracking within 5 days, the request is closed, the seller keeps the money, and funds release normally.
3. 17track monitors the return parcel exactly as it monitors outbound parcels.
4. When the return is scanned as **delivered back to the seller**, the refund fires automatically through `stripe-connect-refund` (single mode, reverse transfer, fee clawback) - same money path as today.
5. Both parties get notifications at each step: return required, return posted, return delivered, refund paid.

### Return postage

Default: the **buyer pays return postage** for change-of-mind-style claims, and the refund covers item + original shipping. If the admin rules the seller at fault (counterfeit, wrong item, clearly damaged), the admin can tick "seller at fault", which refunds the buyer's return postage on top. This is the one decision worth confirming - tell me if you would rather always cover return postage or never cover it.

### Admin dispute outcomes

The dispute row gains four buttons instead of two:

- Require return (starts the return clock)
- Refund without return (fraud, lost item, unsafe to post back)
- Dismiss (seller keeps the money)
- Seller at fault toggle (covers return postage)

### Status visibility

Both buyer and seller see a clear state on the order/sale screen with a deadline: "Awaiting seller response - 14 days", "Return required - post by X", "Return in transit", "Under Flea review", "Refunded".

## Technical notes

- Migration: add `orders.return_required_at`, `return_deadline_at`, `return_tracking_provider`, `return_tracking_number`, `return_delivered_at`, `return_postage_covered`, `refund_path` (`return` or `direct`).
- `request_refund`: set `refund_request_deadline_at` to `now() + 14 days`; set `refund_path` from the selected reason.
- `respond_to_refund_request`: on approve with `refund_path = 'return'`, set `return_required_at` and `return_deadline_at` instead of refunding immediately.
- `auto-approve-refund-requests`: stop refunding on lapse; move the order into the dispute queue and notify admin.
- New cron `close-stale-returns`: closes returns whose 5-day posting deadline passed with no tracking.
- 17track: register return tracking numbers under a `return` shipment kind in `tracking_shipments`; the delivered webhook triggers the refund.
- Admin: extend `useAdminApprovals` dispute tab with the new outcomes; extend the dispute query to include lapsed 14-day requests.
- UI: new return-tracking entry sheet for the buyer reusing `auCarriers.ts`, plus a `RefundStatusRow` on order and sale details.
- Copy updates: FAQ and Terms need the 14-day seller window and the return requirement spelled out.

## Build order

1. Migration and `request_refund` / `respond_to_refund_request` changes (14 days, refund path).
2. Return required state, buyer return-tracking sheet, 17track registration.
3. Refund-on-return-delivered trigger and notifications.
4. Admin dispute outcomes and lapsed-request routing.
5. Status rows for both parties, reminder crons, FAQ and Terms copy.

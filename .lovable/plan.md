# One shared order status tracker for buyers and sellers

Today the status tracker only has three steps (Purchased / Shipped / Delivered), it is hidden in several states (buyer: hidden once completed; seller: hidden until shipped; both: hidden when refunded), and the "In transit" reality from 17track scans is only shown separately in the Carrier Updates block.

## What changes for users

Both the order details drawer (buyer) and the sale details drawer (seller) show the same status timeline, always, with dates on every completed step:

1. **Purchased** - order created date
2. **Shipped** - seller marked shipped
3. **In transit** - first real carrier scan from 17track (falls back to the latest carrier event time)
4. **Delivered** - carrier delivery scan, buyer confirmation, or admin approval
5. **Completed** - the buyer confirms the order (or reports an issue) after delivery. Confirming releases the seller's payout straight away; the 48h window is only the fallback if the buyer never responds.

Once delivered and not yet completed:
- Buyer sees a prompt line on the Completed step: "Confirm your order or report an issue - auto-completes Aug 7, 9:27pm". The existing Complete / Report Issue buttons and dialog stay as they are.
- Seller sees "Payout releases when the buyer confirms, or automatically Aug 7, 9:27pm".

After completion the step shows the actual completion date, worded "Order complete" for the buyer and "Payout released" for the seller.

If the order is **refunded or cancelled**, the timeline stops and shows a final red-marked **Refunded** step with the refund date instead of Delivered/Completed.

Carrier Updates (the expandable scan history) stays below the tracker as it is today.


## Technical notes

- `src/components/ShippingStatusTracker.tsx`: extend `ShippingStep` to include `in_transit`, `completed`, `refunded`; accept `completedAt`, `disputeWindowEndsAt`, `refundedAt`, `inTransitAt`, a `role` prop (`buyer` | `seller`) for the payout wording, and widen `status` to include `completed` and `refunded`. Refunded renders as a terminal muted/destructive step; keep the existing circle/line visual language.
- New shared hook `src/hooks/useShipmentTracking.ts` (extracted from the query already inside `TrackingEvents.tsx`) returning the latest `tracking_shipments` row for an order group, so both the tracker and the events list read one cached query. `first_scan_at` drives the In transit timestamp.
- `src/components/OrderDetailsSheet.tsx` and `src/components/SalesDetailsSheet.tsx`: render the tracker unconditionally (remove the `!isRefunded` / status gates), pass the new props from `primaryOrder` (`completed_at`, `dispute_window_ends_at`, `refunded_at`) plus the shipment's `first_scan_at`, and pass `role`.
- No database or edge function changes - all fields already exist on `orders` and `tracking_shipments`, and 17track already writes `first_scan_at` and `delivered_at` via `applyTracking`.

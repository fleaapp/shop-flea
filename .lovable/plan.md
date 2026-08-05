# One shared order status tracker for buyers and sellers

Today the status tracker only has three steps (Purchased / Shipped / Delivered), it is hidden in several states (buyer: hidden once completed; seller: hidden until shipped; both: hidden when refunded), and the "In transit" reality from 17track scans is only shown separately in the Carrier Updates block.

## What changes for users

Both the order details drawer (buyer) and the sale details drawer (seller) show the same status timeline, always, with dates on every completed step:

1. **Purchased** - order created date
2. **Shipped** - seller marked shipped
3. **In transit** - first real carrier scan from 17track (falls back to the latest carrier event time)
4. **Delivered** - carrier delivery scan, buyer confirmation, or admin approval
5. **Completed** - funds released to the seller 48h after delivery. Before that point this step shows a live countdown line: "Funds release Aug 7, 9:27pm". Seller wording is payout-focused ("Payout released"), buyer wording is "Order complete".

If the order is **refunded or cancelled**, the timeline stops and shows a final red-marked **Refunded** step with the refund date instead of Delivered/Completed.

Carrier Updates (the expandable scan history) stays below the tracker as it is today.

## Technical notes

- `src/components/ShippingStatusTracker.tsx`: extend `ShippingStep` to include `in_transit`, `completed`, `refunded`; accept `completedAt`, `disputeWindowEndsAt`, `refundedAt`, `inTransitAt`, a `role` prop (`buyer` | `seller`) for the payout wording, and widen `status` to include `completed` and `refunded`. Refunded renders as a terminal muted/destructive step; keep the existing circle/line visual language.
- New shared hook `src/hooks/useShipmentTracking.ts` (extracted from the query already inside `TrackingEvents.tsx`) returning the latest `tracking_shipments` row for an order group, so both the tracker and the events list read one cached query. `first_scan_at` drives the In transit timestamp.
- `src/components/OrderDetailsSheet.tsx` and `src/components/SalesDetailsSheet.tsx`: render the tracker unconditionally (remove the `!isRefunded` / status gates), pass the new props from `primaryOrder` (`completed_at`, `dispute_window_ends_at`, `refunded_at`) plus the shipment's `first_scan_at`, and pass `role`.
- No database or edge function changes - all fields already exist on `orders` and `tracking_shipments`, and 17track already writes `first_scan_at` and `delivered_at` via `applyTracking`.

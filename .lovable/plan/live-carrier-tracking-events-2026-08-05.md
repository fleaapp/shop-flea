# Live carrier tracking events

Today the app only knows what the seller tells it: `mark_order_shipped` records a carrier + number, and `ShippingStatusTracker` shows Purchased / Shipped / Delivered from seller actions and timers. Tracking links just open the carrier's own page in an in-app browser (`src/lib/tracking.ts`) - no event data comes back.

This plan pulls real carrier scans into Flea and lets those scans, not timers, drive delivery, the dispute window and payout release.

## Provider

Use **17track** as the tracking data source:
- Free tier covers a low volume of shipments per month, no carrier contract needed
- Supports AusPost, StarTrack, Sendle, CouriersPlease, Aramex, TNT, DHL, Toll, FedEx (the carriers already in `tracking.ts`)
- Push webhook, so we don't poll constantly

If volume outgrows the free tier, the same design swaps to AfterShip or the Australia Post API by changing one adapter file.

You'll need to create a 17track account and give me the API key when we build - I'll ask for it securely at that point.

## What changes for users

**Buyer - order details**
- Live status line under the tracker: "In transit - Arrived at Sydney facility, 2 Aug 4:12pm"
- Expandable event history (most recent first)
- "Delivered" now stamps automatically from the carrier scan, not just seller/buyer action

**Seller - sale details**
- Same live status, so sellers can see the parcel is moving
- Bad tracking number is caught early: if the carrier reports "not found" 24h after shipping, the seller gets an alert to fix it

**Payments**
- Delivery confirmed by a carrier scan starts the dispute window immediately and releases funds on schedule
- If no carrier confirmation ever arrives, current fallback timers still apply, so nothing gets stuck
- Sales with a carrier-confirmed delivery are marked as such in the admin transactions view, which strengthens refund disputes

## Technical design

**Database (migration)**
- `tracking_shipments`: one row per order group - carrier code, tracking number, provider status, last event summary, last synced timestamp, raw payload
- `tracking_events`: shipment id, event time, status code, description, location; unique on (shipment, event time, description) so replays don't duplicate
- Both with GRANTs + RLS: buyer and seller of the order can SELECT; writes are service-role only (edge functions)

**Edge functions**
- `tracking-register` - called from `mark_order_shipped`'s client path; registers the number with 17track and creates the `tracking_shipments` row
- `tracking-webhook` - `verify_jwt = false`, validates the provider signature, upserts events, and maps provider status to our order lifecycle:
  - in transit / out for delivery -> keep `shipped`, update live status
  - delivered -> call existing `mark_order_delivered` with source `carrier`, which already sets `dispute_window_ends_at` and gates payout
  - exception / not found -> flag the shipment, notify the seller
- `tracking-sync` - daily pg_cron reconciliation for anything the webhook missed, plus the "invalid tracking number" check

**Frontend**
- `src/lib/tracking.ts` gains a carrier-code map for the provider (keeps existing URL builders as the fallback link)
- New `TrackingEvents` component rendered inside `OrderDetailsSheet` and `SalesDetailsSheet` under `ShippingStatusTracker`
- `ShippingStatusTracker` gains a real `in_transit` timestamp from the first carrier scan

**Safety**
- Carrier delivery only ever advances an order; it never reverses a refund, cancellation or completed state
- Existing auto-deliver / auto-complete jobs stay as the fallback for untracked or unsupported carriers

## Build order

1. Migration for the two tracking tables
2. Request the 17track API key
3. `tracking-webhook` + `tracking-register` edge functions
4. Wire registration into the shipping flow
5. Frontend event timeline in order and sale details
6. Daily `tracking-sync` cron and seller "bad tracking number" alert


## Goal

1. Automatically refund the buyer if the seller hasn't marked the order as shipped within 9 days.
2. Make sure seller payouts (both scheduled and instant) can only happen after eligible tracking has been entered on the order.

Both are already partly in place — the shipping-reminders cron sends 3-day and 6-day nudges, and `mark_order_shipped` already requires a `tracking_provider` and `tracking_number` from an eligible AU carrier. We just need to close the loop.

---

## 1. Auto-refund at day 9

### New edge function: `auto-refund-unshipped`

Runs on pg_cron every hour. Service-role auth (same pattern as `shipping-reminders`).

Logic:
- Select `orders` where `status = 'awaiting'` AND `created_at <= now() - 9 days` AND `refunded_at IS NULL` AND `shipped_at IS NULL`.
- For each order:
  - Call the existing `stripe-connect-refund` logic (reuse the helper — reverse transfer + refund application fee so the buyer's 4% + $0.70 fee is also returned).
  - Set `orders.status = 'refunded'`, `refunded_at = now()`, `refund_reason = 'auto_unshipped_9d'`.
  - Reactivate the listing (`status = 'active'`) so it's not stuck as sold.
  - Notify **buyer**: "Your order was automatically refunded because the seller didn't ship within 9 days."
  - Notify **seller**: "Your sale of <item> was auto-refunded because tracking wasn't added within 9 days. Repeated auto-refunds may affect your account."
  - Log to `payment_events` for the audit trail.

### Warning nudge at day 8

Extend `shipping-reminders` to send a "final warning" at day 8: "Ship in the next 24 hours or this order will be auto-refunded." This gives the seller a clear last chance and reduces support tickets.

### Terms update

Add a short clause to `src/pages/Terms.tsx`: "Orders not marked as shipped with valid tracking within 9 days of purchase will be automatically refunded to the buyer, and the sale cancelled."

---

## 2. Gate payouts on eligible tracking

Tracking entry is already enforced at the point the seller marks an order shipped — the `mark_order_shipped` RPC rejects empty `tracking_provider` / `tracking_number`, and the shipping UI restricts carrier selection to eligible AU carriers (AfterShip list). So "shipped with tracking" and "shipped" are already equivalent in our data model.

What we need to add is a payout-time guard so a seller cannot pull funds out via Instant Payout for orders that are still `awaiting` (i.e. money is sitting in their Stripe balance from a sale where they haven't shipped yet).

### Changes to `stripe-connect-payout` (instant payout)

Before creating the Stripe payout:
1. Compute `unshipped_cents` = sum of `price + shipping_price` for that seller's orders where `status = 'awaiting'` AND `refunded_at IS NULL`.
2. Fetch Stripe available balance.
3. Cap the requested payout at `available_balance - unshipped_cents`. If the buyer clicks "Payout all", we only pay out the shipped-and-cleared portion.
4. If `unshipped_cents >= available_balance`, return `409` with `{ reason: 'awaiting_shipment', unshipped_cents }` and the UI shows: "You have $X in sales awaiting shipment. Ship those orders with tracking before you can withdraw."

### Changes to Stripe scheduled payouts

For Express/Standard accounts, Stripe's default automatic payout schedule doesn't know which charges are still "awaiting shipment" on Flea. To avoid a seller getting auto-paid before shipping:

- On account creation in `stripe-connect-onboard`, set `settings.payouts.schedule.interval = 'manual'` on the connected account. That way Stripe never auto-pays; all payouts go through our `stripe-connect-payout` function which enforces the guard above.
- Add a nightly cron `sweep-eligible-payouts` that, for each verified seller with a positive available balance, releases the shipped-and-cleared portion as a standard payout (same guard function reused). This keeps sellers paid on a regular cadence without giving them access to unshipped funds.

### UI changes on Seller Dashboard

- Show two balance lines when relevant:
  - **Available to withdraw**: cleared balance minus unshipped orders
  - **Awaiting shipment**: unshipped_cents, with copy "Ship your open orders with tracking to release these funds."
- Disable the Instant Payout and Payout buttons when Available to withdraw is $0, with a tooltip explaining why.

---

## Technical details

Files to add:
- `supabase/functions/auto-refund-unshipped/index.ts`
- `supabase/functions/sweep-eligible-payouts/index.ts`
- pg_cron jobs (via `supabase--insert`) to schedule both hourly/daily

Files to modify:
- `supabase/functions/shipping-reminders/index.ts` — add day-8 final-warning branch
- `supabase/functions/stripe-connect-payout/index.ts` — add unshipped-cents guard, cap payout amount
- `supabase/functions/stripe-connect-onboard/index.ts` — set manual payout schedule on account creation; run a one-time migration for existing accounts on next `stripe-connect-status` call
- `supabase/functions/stripe-connect-status/index.ts` — return `unshipped_cents` and `available_to_withdraw_cents` alongside current balance
- `src/pages/SellerDashboard.tsx` — surface the split balances and gate the payout buttons
- `src/pages/Terms.tsx` — add the 9-day auto-refund clause
- No schema change required (reuses `orders.status`, `refunded_at`, `refund_reason`).

Notes:
- All notifications go through the standard `send-push-notification` pipeline and follow existing copy conventions (trailing full stop, celebratory emojis, no em dashes).
- The "eligible tracking" definition stays as it is today: a valid AU carrier from the AfterShip list plus a non-empty tracking number, enforced by `mark_order_shipped`. No new "verify tracking is real" step — that would need AfterShip API polling and is out of scope.

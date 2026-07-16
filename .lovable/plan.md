## Changes

### 1. Seller Dashboard: move Pending under Available
Move the **Pending** row from below the payout buttons to sit **directly under the "Available to withdraw" box**, before the "Pay out to bank" / "Instant payout" buttons. Payout buttons + first-payout note stay where they are, just now below Pending.

File: `src/pages/SellerDashboard.tsx` — reorder the two sections (~lines 322-387).

### 2. Sale Details sheet: kill every Stripe link, replace with in-app payouts entry

In `src/components/SalesDetailsSheet.tsx`:

- **Remove the entire "Payment & Payout" section** (lines 309-347) — the "View order on Stripe →" link, the "Need your funds faster?" copy, and the "Instant payout" button that opens `dashboard.stripe.com/payouts`.
- **Replace it with a single in-app button** styled like the other charcoal actions:
  - Label: **Seller dashboard**
  - Subheader under it: *View payouts*
  - Tap → closes sheet, `navigate('/seller-dashboard')`.
- **Refund sale button** (line 352):
  - No longer opens `dashboard.stripe.com/payments`.
  - Opens an in-app `AlertDialog` — *"Refund this sale? The full amount will be returned to the buyer and taken out of your Flea balance."* → Cancel / Refund.
  - On confirm: `invokeCloudFunction('stripe-connect-refund', { orderId, reason: 'requested_by_customer' })`, show toast, close sheet, invalidate orders.
  - Only show the button while the order is refundable (not already `refunded_at`, and within the 10-day-post-delivery / 30-day-post-order window — matches server enforcement).

The `stripe-connect-refund` function already uses `reverse_transfer: true` + `refund_application_fee: true`, so the money comes out of the seller's Connect balance (and pushes it negative if insufficient — see below). No backend changes needed.

### Answer: current negative-balance setup

We already have full coverage. Nothing to build for this question, just explaining.

1. **Where negatives come from.** Refunds and Stripe disputes use `reverse_transfer` against the seller's Connect balance. If the balance is too low, Stripe leaves the connected account with a negative balance.
2. **Sync to our DB.** The `stripe-webhook` and `stripe-connect-status` functions read the connected account's balance and write the shortfall to `profiles.negative_balance_cents` (+ `negative_balance_updated_at`). Push notification fires when it flips negative.
3. **Seller Dashboard.** When `negative_balance_cents > 0`, the Available box swaps for a red "Balance owed" card with a **Settle balance** button that opens `SettleBalanceSheet`. That sheet calls `stripe-connect-topup` to create a PaymentIntent on the connected account, shows a per-refund/dispute breakdown, and lets them pay with card/Apple Pay in-app.
4. **Gates while negative.**
   - Buying: `stripe-connect-payment-intent` blocks with `code: negative_balance` (409).
   - Listing: `CreateListing` blocks and prompts settle.
   - Payouts: `stripe-connect-payout` refuses because available < 0.
   - Account deletion: `delete-account` refuses until settled.
   - Re-registering on the same device: `check-device-eligibility` reads `blocked_devices` (populated on account deletion / signout with debt) and blocks sign-up on that device fingerprint.
5. **After settlement.** Topup succeeds → webhook clears `negative_balance_cents` → gates lift, push confirms, dashboard returns to Available.

### Technical notes
- Files touched: `src/pages/SellerDashboard.tsx`, `src/components/SalesDetailsSheet.tsx`.
- No backend, no schema, no edge-function changes.
- All Stripe deep links removed from Sale Details. If we find any other `dashboard.stripe.com` links anywhere else, we should sweep them in the same pass — none are expected outside this sheet.
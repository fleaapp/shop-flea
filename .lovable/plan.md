# Seller payment accuracy: pending, fees and payouts

## What the $4.75 actually is

I traced the exact orders behind the number. Nothing is missing money - but the dashboard is showing the wrong figure in two ways at once.

Seller @sarahhearn2 currently has two orders whose funds are still held:

| Order | Item | Price | Shipping | Buyer coupon | Transaction fee | Seller actually receives |
|---|---|---|---|---|---|---|
| FL-001010 | Dress | $4.25 | $0.00 | FREEFLEA | $0.59 | $3.66 |
| FL-001007 | Test (delivered, protection window still open) | $0.50 | $0.00 | - | $0.00 (pre-fee sale) | $0.50 |

$4.25 + $0.50 = **$4.75**. So:

1. The "unexplained $0.50" is a real second order - a delivered Test item still inside buyer protection. It is invisible because the "Sales in progress" list only lists orders with status awaiting or shipped, so delivered-but-held orders are counted in the total and never listed.
2. The Pending total and each row are **gross** (price + shipping). The seller's transaction fee is never subtracted, so Pending reads $4.75 when the seller will actually receive $4.16. Available to withdraw, by contrast, comes straight from the payment provider and is already net - so the two boxes speak different languages.

Everything downstream of that (the fee split sent to the payment provider, the fee snapshot written onto each order, sale details, refunds) checks out as correct. The fault is display and hold arithmetic, not money movement.

## Fixes

### 1. Held funds become net, not gross (backend)
In the seller dashboard function, the held-funds figure sums `price + shipping` per order. Subtract each order's stored transaction fee so the held amount matches what will actually land. This also stops the ring-fence over-withholding from Available to withdraw.

### 2. Pending list shows every held order
Include delivered orders still inside the 48-hour protection window and orders with an open refund request in the "Sales in progress" list, using the same held rule the backend uses. Add a short status word per row (Awaiting shipment, Shipped, Delivered - protection window, Refund requested) so no row is a mystery.

### 3. Pending rows show net earnings
Each row shows what the seller receives for that sale (price + shipping - transaction fee), consistent with the Sale details drawer. Rows with no fee snapshot (older sales) stay at gross, which is correct for them.

### 4. Pending panel gets a plain-English breakdown
Under the total: "Sale total $4.75 - fees $0.59 = $4.16 to you." So the seller can reconcile the header against the rows.

### 5. Sales list bubbles show net
The amount bubble on each sale card in Sales currently shows gross subtotal while the Sale details drawer shows "You received". Switch the bubble to the net figure so a seller never sees two different numbers for the same sale.

### 6. Settings balance summary follows
The "Available / Pending" pair under the seller dashboard button recomputes the same pending figure client-side. Point it at the corrected backend numbers so all three surfaces agree.

## Audit of everything else (no changes needed)

- **Buyer checkout**: buyer pays items + shipping + Secure Checkout Fee (4% + $0.70). Server recomputes the total and rejects a mismatch, so a tampered or stale client cannot underpay.
- **Fee split**: the platform fee taken on the charge is Secure Checkout Fee + Transaction Fee, clamped below the charge amount on very cheap items. The remainder transfers to the seller, so the payment provider's net already equals the seller's true earnings.
- **Coupons**: FREEFLEA zeroes only the buyer fee; the seller transaction fee still applies. Order rows correctly store `secure_checkout_fee` 0 and `transaction_fee` 0.59 for the Dress.
- **Offers**: accepted offer price flows through as the item price and every downstream fee is computed from it.
- **Refunds and partial refunds**: pro-rata split uses the fees actually charged, refunded items are excluded from seller net entirely, transfers are reversed. Verified against the six refunded rows on this account.
- **Failed / pending payments**: no order row is created until the charge succeeds; orphan charges are reconciled and refunded by the existing job.
- **Payouts**: gated on approved tracking, delivery and the protection window, matching the held rule above.

## Technical notes

- `supabase/functions/stripe-connect-dashboard/index.ts` - held-funds sum subtracts `transaction_fee`; return a per-order held breakdown (order id, group id, title-less amounts, status, net) so the client stops re-deriving it.
- `src/pages/SellerDashboard.tsx` - consume the held breakdown for the "Sales in progress" list, include delivered-in-window and refund-requested groups, render net per row plus the fee summary line.
- `src/pages/Sales.tsx` - swap `subtotal` for `youReceived` from `computeSellerNet`.
- `src/components/PaymentMethodsSection.tsx` - use the corrected pending value rather than recomputing.
- No change to `feeCalculator.ts`, `_shared/fees.ts`, or any money-moving path.

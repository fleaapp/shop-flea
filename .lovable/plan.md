## Change
Strip the Secure Checkout Fee out of every seller-facing amount in the Recent activity list on the Seller Dashboard. The buyer pays the fee and Flea keeps it — it should never appear in a seller's ledger.

## File
`src/pages/SellerDashboard.tsx` — Recent activity section (~lines 672–712).

## Edits
1. For each row, display the **net** amount instead of gross:
   - `const displayAmount = a.net ?? (a.amount - (a.fee || 0));`
   - Use `displayAmount` for the sign (`isOut`) and the rendered figure.
2. Remove the `· Fee {fmtMoney(a.fee, currency)}` suffix from the subline entirely.
3. Hide fee-only ledger rows so the fee doesn't sneak back in as its own line:
   - Filter out `application_fee`, `application_fee_refund`, and `stripe_fee` from `visible`.
   - Drop those cases from `activityMeta` since they'll no longer render.

## Out of scope
- No changes to Pending / Available / First payout hold math (already net after the previous fix).
- No backend, checkout, receipt, or sale-details changes — those already show seller-net correctly.

Live check on @sarahhearn2's payment account: `chargesEnabled: true`, `payoutsEnabled: true`, no due requirements, AU bank attached. The account is fine. The checkout breakage is a client-side gating bug.

## Correct verification rule

- **Selling / listing / buying from that seller** → require `chargesEnabled === true` only.
- **Withdrawing to bank** → require `payoutsEnabled === true` (separate button in Seller Dashboard).

Rationale: brand new AU sellers frequently have `payoutsEnabled: false` for a fraud-hold window even when fully verified. Gating listing/checkout on payouts would lock every new seller out of selling on day one.

## Fixes

1. **Checkout — treat live status as authority**
   - For every unique seller in the cart, call the payment status function.
   - Mark the seller as payable when `chargesEnabled === true` (ignore `payoutsEnabled` and stale profile flags for this gate).
   - Show a proper loading state while the check is in flight, instead of a disabled screen with no fee, no wallet, and no card option.
   - If a seller genuinely cannot charge, show an inline message: "This seller can't accept payments right now."

2. **Listing gates**
   - Create Listing and Edit Listing: require live `chargesEnabled === true` for the current user. `stripe_onboarding_complete` alone is not enough; `payoutsEnabled` is not required.
   - If the seller has an account but `chargesEnabled` is false, route them into the in-app native seller setup sheet (no external redirects), pre-focused on whatever Stripe is asking for.

3. **Seller Dashboard — payouts UI clarity**
   - Keep "Withdraw to bank" gated on `payoutsEnabled`.
   - When `chargesEnabled` is true but `payoutsEnabled` is false, show a small helper line under the balance: "Payouts unlock after your first sale is delivered. You can keep selling in the meantime." No scary banners.

4. **Backend consistency**
   - `stripe-connect-payment-intent` currently requires both `charges_enabled` and `payouts_enabled` before creating a PaymentIntent. Relax to `charges_enabled` only, so the frontend and backend agree.
   - Auto-refund / payout / dispute flows are unaffected — they already read live balance and payout eligibility separately.

5. **Verify after implementation**
   - Log in as another account, add one of Sarah's listings, open checkout: fee row, Apple Pay + card picker, and enabled "Confirm order" should all appear.
   - As a hypothetical "verified but payouts paused" seller: they can still list and receive orders; only the Withdraw button is disabled with a friendly note.
   - Check function logs for any residual `seller_payouts_disabled` rejections after the backend gate is relaxed.
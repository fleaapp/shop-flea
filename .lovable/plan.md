## Changes

**1. `src/components/SalesDetailsSheet.tsx` (line ~389)**
Change the Seller dashboard button background from `bg-muted-foreground/20` to `bg-card` so it matches the white settings-row style used in Payment Methods.

**2. `src/components/PaymentMethodsSection.tsx`**
When the seller is fully connected (`stripeFullyConnected === true`), replace the current status label ("Connected") beneath the "Seller Dashboard" row with two small lines showing live balance:

```
Available: $X.XX
Pending:   $Y.YY
```

- Fetch via the existing `stripe-connect-dashboard` edge function (same source `SellerDashboard.tsx` uses).
- Only call it when `stripeFullyConnected` is true; skip for unverified sellers (still show "Become a Seller" copy unchanged).
- Amounts formatted with the existing money formatter, AUD, 2 decimals.
- While loading, show a subtle placeholder ("Available: —" / "Pending: —") so the row height stays stable.
- Re-fetch on window focus / visibility change so it stays fresh, matching the dashboard behaviour.

No other rows or copy change. No backend changes.
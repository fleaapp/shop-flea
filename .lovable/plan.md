## Fix
Settings "Seller Dashboard" button balances are wrong because they use Stripe's raw `available`, which ignores funds ring-fenced for unshipped orders.

## File
`src/components/PaymentMethodsSection.tsx` (~lines 190–199)

## Edit
- Replace `available` with `availableToWithdraw` (already returned by `stripe-connect-dashboard` = raw available − unshipped, floored at 0). This makes the button show $0 Available when everything is held for unshipped orders.
- Leave `pending` as-is: Stripe's raw pending balance already includes the first-payout-hold funds, which is exactly the "pending + hold" the user asked for on the button.

```ts
const availableCents = (data as any).availableToWithdraw ?? (data as any).available ?? 0;
const pendingCents   = (data as any).pending ?? 0;
```

## Out of scope
- No change to Seller Dashboard cards, checkout, receipts, or backend — those already use the correct net figures.

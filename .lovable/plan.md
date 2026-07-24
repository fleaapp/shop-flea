## Why it shows $2.00

Stripe's raw `pending` balance is only $2.00 right now because 4 of the 6 unshipped orders' funds already cleared through Stripe's 2-day rolling window and moved into Stripe's `available` bucket — even though the seller hasn't shipped them yet. Those "cleared but unshipped" funds are ring-fenced by Flea (`unshippedCents`), not by Stripe, so they don't appear in Stripe's `pending`.

Verified from the live edge response for @sarahhearn2:
`available=320, pending=200, unshippedCents=420, activity firstHold(net)=100`

My previous fix reduced to raw Stripe pending, which gives $2.00 — wrong.

## The right formula (matches Seller Dashboard exactly)

```
firstHold           = net of earliest pending payment (only until first payout) = 100
unshippedRemaining  = max(unshipped − firstHold, 0)                             = 320
unshippedInPending  = max(unshippedRemaining − available, 0)                    = 0
clearing            = max(pending − firstHold − unshippedInPending, 0)          = 100
dashboardPending    = unshippedRemaining + clearing                             = 420  ($4.20 ✓)
settingsPending     = dashboardPending + firstHold                              = 520  ($5.20 ✓)
```

## Fix

Update the balance computation in `src/components/PaymentMethodsSection.tsx` to use the full dashboard formula above instead of `rawPending − firstHold`. Available stays as `availableToWithdraw`. No backend or fee changes.

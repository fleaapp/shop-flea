## Seller Dashboard — balance & payout UI refinements

Scope: `src/pages/SellerDashboard.tsx` only. UI/copy on top of the existing four-bucket allocation (Held for unshipped → Clearing → First payout hold → Available). No backend or fee logic changes.

### 1. Clearing row

- Only render the "Clearing from recent sales" row when there are shipped orders still clearing (`clearing > 0` after First payout hold + Held for unshipped are subtracted from Stripe pending). Otherwise hide the row entirely.
- Add an info button (same `Info` + `Popover` pattern as `ConditionInfoPopover` / `SecureCheckoutInfoPopover`) next to the label.
  - Title: `Clearing from recent sales`
  - Body: `Funds from orders you've already shipped that are still clearing with the payment provider. Card payments settle 1 to 2 business days after the buyer pays, then move to Available automatically.`
- Keep the existing per-row release date line ("Ready [date]") sourced from Stripe `available_on`.

### 2. Info buttons on the other balance rows

Same popover style for consistency.

- **Held for unshipped orders** — `Funds from sales you haven't shipped yet. Add tracking to release these funds into Clearing (or straight to Available if the payment has already cleared).`
- **First payout hold** — `A one-off security check applied to your very first sale. Usually clears within 7 days. After this, future sales only go through the standard 1 to 2 day clearing window.`
- **Available to withdraw** — `Ready to pay out. Standard payout lands in your bank in about 24 hours. Instant Payout arrives in around 30 minutes for a 1.5% fee.`

### 3. Payout actions — new layout

Replace the current stacked payout block with:

```text
[   $X.XX Available   ]

[      Pay out to bank      ]     ← full-width primary (lime), unchanged style
Standard payout usually 24 hours.

Need the funds faster? Use Instant Payout (around 30 minutes) for a 1.5% fee. Available after the security hold clears.

[      Instant Payout         ]   ← full-width secondary
[      1.5% fee               ]   ← second line inside the same button, smaller/muted
```

- Both buttons full width, stacked. Pay out on top, Instant Payout below.
- Helper copy sits BETWEEN the two buttons: "Standard payout usually 24 hours." immediately under Pay out; then the "Need the funds faster?" line directly ABOVE Instant Payout.
- Instant Payout button shows two lines internally: "Instant Payout" then "1.5% fee" (smaller, muted).
- Instant Payout stays greyed out / disabled with the current rule (First payout hold cleared AND `instantPayoutEligible`). Helper copy explains why it's locked.
- Standard Pay out button disabled when `availableToWithdraw === 0`, unchanged behaviour.

### 4. Remove "Please note" box

Delete the "Please note" card entirely — its content is now covered by the three info popovers and the two helper lines around the payout buttons.

### Out of scope

- No changes to allocation math, edge functions, Stripe calls, or fee percentages.
- No changes to payout history, activity list, or other dashboard sections.

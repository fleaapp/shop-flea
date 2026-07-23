## Goal

Clarify seller dashboard balance so the first sale (held under Stripe's first-payout security review) is visually separated from subsequent sales that are only clearing the card network. Each row shows its own amount and its own ready date, so numbers reconcile to the Stripe pending total exactly.

## Reliability note (background, not shipped copy)

- `available_on` on a Stripe balance transaction is reliable for **card clearing** (Pending → Available). For AU cards this is ~2 business days, which is why we see dates 48–72h out.
- The **first-payout hold** (7–14 days on new AU Connect accounts) is a separate payout-schedule delay Stripe applies on top; it is not exposed on individual charges. We can't read it directly, so we infer it from "no paid payout yet" and treat the earliest pending charge as the one under first-payout review.
- After the first payout lands, subsequent sales genuinely follow `available_on` (~2 business days). So the current "Ready {date}" copy is trustworthy for the non-first-sale rows, and misleading only for the very first sale.

## UI changes in `src/pages/SellerDashboard.tsx`

Rendering order stays the same, but the Pending bucket is split:

1. **First payout hold** (only shown while no payout has ever been marked `paid`)
   - Amount = the earliest pending activity item's amount (the first sale under Stripe review).
   - Copy: "Your first sale is being verified by our payment processor. This is a one-off security check on new seller accounts."
   - Ready line: omit the specific `available_on` date (unreliable for the first sale) and instead say `Usually ready within 7–14 days.` Once Stripe confirms a real payout `arrival_date` for the first payout we can swap in that date, but until then no hard date.
   - Styled as the existing amber card.

2. **Clearing from recent sales** (neutral card)
   - Amount = `pending − firstHoldAmount` (only rendered if > 0, i.e. once there is a second sale, or after the first payout has cleared and everything else is normal clearing).
   - Ready line uses the earliest `available_on` across the remaining pending items: `Ready {date}.`

3. **Held for unshipped orders** — unchanged (still only shown once funds sit in Available, to avoid double-counting Pending).

4. **Available to withdraw** headline — unchanged.

Once `hasPaidPayout` is true, the First-payout-hold card disappears and the full pending total shows under Clearing again, exactly as today.

## "Please note" copy tweak

In the disabled-instant-payout note, replace the current line about the first payout with:

- "Your first payout goes through a one-off security check and usually clears within 7–14 days."
- Keep the existing subsequent-sale line ("each sale clears on the payment processor's schedule, then standard payout takes 1–2 business days") and the instant payout 1.5% line unchanged.

## Numbers reconcile

`First payout hold + Clearing from recent sales === Stripe pending total`, so the $1 example lands entirely inside "First payout hold" and nothing looks missing.

## Out of scope

No backend / edge function changes. No changes to payout gating, coupon logic, or notifications.

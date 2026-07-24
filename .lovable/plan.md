## Goal

Simplify the Seller Dashboard payout section into Available + Pending (plus the existing First payout hold card, kept as-is), with an expandable dropdown under Pending that lists each active sale with two status bubbles — Shipped and Cleared — coloured lime when done and grey when still waiting.

## Changes (all in `src/pages/SellerDashboard.tsx`)

### 1. Collapse "Held for unshipped" + "Clearing" into one Pending card

Remove the "Held for unshipped orders" and "Clearing from recent sales" sections (lines ~403–444). Keep the "First payout hold" amber card (lines ~446–468) exactly as-is.

Add one new Pending card in their place:

- Style: `rounded-2xl bg-card border border-border p-4 mt-2`.
- Header: label "Pending" + `BalanceInfo` popover on the left, total on the right.
- Amount = `unshippedRemaining + clearing` (the previous two figures added together, first-hold stays in its own card).
- Sub-line: earliest `available_on` from pending payments → "Next release: 12 Nov" (only if present).

### 2. Info popover copy (Pending)

Reuse existing `BalanceInfo`. Body:

> Funds waiting to be released.
>
> - Valid tracking must be added before funds from a sale can be released.
> - An item may already be shipped but funds can still stay Pending while they complete the clearing period, usually around 24 hours.

### 3. Expandable "Sales in progress" dropdown inside the Pending card

Below the amount, a chevron toggle: "View sales in progress ({count})", collapsed by default. When open, render one row per active sale.

Data source: `useOrders()` sales feed, filtered to orders where funds are still pending (status `awaiting` or `shipped`, not `delivered` / `refunded`, not part of a paid payout).

Each row shows, on a single line:

- Left: item name — or the literal string `Bundle` when the order/group contains multiple listings.
- Middle: amount `$X.XX`.
- Right: two small status bubbles side-by-side:
  - `Shipped` — lime (`bg-primary/60 text-charcoal`) if the order has valid tracking / `shipped_at`, otherwise grey (`bg-muted text-charcoal/70`).
  - `Cleared` — lime if the matching Stripe activity row is no longer pending (or `available_on` has passed), otherwise grey.

Bubble style: `text-[11px] font-medium px-2 py-0.5 rounded-full`.

Hide the dropdown entirely when there are no active pending sales.

### 4. Payout summary reads as

- Pending card (new, combined unshipped + clearing) — grey/white.
- First payout hold card (unchanged) — amber, only when applicable.
- Available to withdraw card (unchanged) — lime.

### 5. Instant Payout button restyle

Change the Instant Payout button (lines ~534–545) to the muted grey previously used by the Clearing card: replace `variant="outline"` + charcoal border classes with `bg-muted/60 border border-border text-charcoal hover:bg-muted`. Keep size, disabled state, and label unchanged.

## Out of scope

- No edge-function or Stripe balance-math changes — all figures come from existing `data.pending`, `data.unshippedCents`, `data.activity`, and `useOrders()`.
- No change to the negative-balance ("Balance owed") flow.
- First payout hold card and copy stay exactly as they are today.

## Changes in `src/pages/SellerDashboard.tsx`

**Reorder balance cards** (top → bottom):
1. Held for unshipped orders
2. Clearing from recent sales
3. First payout hold
4. Available to withdraw (or Balance owed if negative) — moves to the bottom of the balance stack, styled unchanged (lime headline card)

The Action-required and Set-up-seller banners stay above this stack. Payout action buttons stay directly below the Available card.

**Held for unshipped visibility**: currently only rendered when funds are already in Available. Keep this rule so it doesn't double-count Clearing/First-payout-hold — when nothing is available, this row simply doesn't appear (matches current behaviour, just repositioned).

**Copy tweak**: In the First payout hold card, change `Usually ready within 7–14 days.` → `Usually within 7 days.`

## Out of scope

No changes to backend, payout gating, or numbers logic. Pure reorder + one copy edit.

## Fix
"Cleared" bubble in Sales in progress is currently all-or-nothing (uses one shared `anyStillClearing` flag). If Stripe shows $3.20 available (meaning at least one sale has cleared into the account and is only being held back by unshipped ring-fencing), those specific rows should read Cleared.

## File
`src/pages/SellerDashboard.tsx` — inside the `activeGroups` render (~lines 468–500), replace the shared `cleared` flag with per-row logic.

## Logic
- `stillClearingCount = clearingPending.filter(a => !a.available_on || a.available_on > nowSec).length` (pending rows still inside the clearing window).
- Rank `activeGroups` by `created_at` ascending. The **oldest `activeGroups.length − stillClearingCount`** are treated as cleared; the newest `stillClearingCount` are still clearing.
- Per row: `cleared = orderIndex < activeGroups.length − stillClearingCount`.
- This makes rows flip to Cleared as soon as Stripe moves their funds out of `pending` into `available`, even if the money is still ring-fenced for unshipped orders.

## Out of scope
- No changes to Pending/Available totals, backend, or Settings button — Available on the button correctly stays at $0 when funds are ring-fenced; this only fixes the per-row bubble.

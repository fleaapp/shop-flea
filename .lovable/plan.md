## What's broken

Both "Mark as sold" and "Remove listing" fail because the `listings_update_guard` DB trigger blocks any status change to `sold` or `removed` — its whitelist only allows `active`, `paused`, `archived`. Every owner update to those statuses raises "Invalid status transition", surfacing as the two toast errors in the screenshots.

## Plan

### 1. Fix the update guard (migration)
Rewrite `public.listings_update_guard()` so owners can transition to the statuses the app actually uses:

- Allowed transitions from `active`/`paused`: → `active`, `paused`, `archived`, `sold`, `removed`
- Keep the terminal lock: `sold`, `removed`, `blocked` still cannot change once set
- Keep the protected-field checks (user_id, region_id, report_count, created_at) unchanged
- Keep `service_role` bypass

No RLS or grants change — only the trigger body.

### 2. Add delete button to active listing cards
In `src/components/ProfileGridCard.tsx`, when `activeTab === 'listings'`, render a 🗑️ button immediately to the left of the existing ✏️ edit button (same pill styling, `top-1.5`, positioned just left of the edit button). Tapping it:

- `stopPropagation` so the card doesn't open
- Opens a small confirm `AlertDialog` (same style as EditListing's remove dialog: "Remove listing? This will hide your listing and mark it as removed.")
- On confirm, updates the listing to `status: 'removed'` via supabase, then invalidates the user listings query so the card disappears
- Shows the existing success/error toasts

No other cards (sold tab, wishlist, seller profile) get the button — only the owner's active listings grid.

### Files touched

- `supabase/migrations/<new>.sql` — rewrite `listings_update_guard`
- `src/components/ProfileGridCard.tsx` — add delete button + confirm dialog + mutation

### Not in scope

- The trash + Mark-as-sold buttons already present in EditListing's footer stay as-is; they'll start working once the guard is fixed.
- No changes to notifications, RLS, or the removed-listing cleanup trigger (it already handles the `removed` transition).

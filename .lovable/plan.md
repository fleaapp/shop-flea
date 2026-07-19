## Why the User Management badge doesn't go down

`admin-data.getBadges` counts:
- `users` → **all** profiles created in the last 7 days
- `listings` → **all** currently-active listings
- `refunds` → **all** orders with `refunded_at` set
- `transactions` → **all** orders in `awaiting` status
- `contact`, `waitlist` → total row counts

None of them are "unread". Only `brands` already uses a "last seen" timestamp (`admin_brands_last_seen` in localStorage) so its count drops after you visit that tab. That's why the users badge stays put no matter how many times you open the page.

## Plan

Extend the `brandsSince` pattern to every count-based admin tab so opening a tab clears its badge until new items arrive.

### 1. `supabase/functions/admin-data/index.ts` — `getBadges`
Accept optional ISO timestamps in the payload for each count-based tab:
`usersSince`, `listingsSince`, `refundsSince`, `transactionsSince`, `contactSince`, `waitlistSince` (keep existing `brandsSince`).

For each, if provided, filter by `created_at gte {since}` (for refunds use `refunded_at gte {since}`, for transactions keep the `awaiting` status filter but add `created_at gte`). If not provided, fall back to the current behavior so nothing regresses on first load.

Leave `support`, `reports`, `bans`, `suggestions`, `errorLogs` alone — they're already true "unread/pending" counts driven by a status column.

### 2. `src/hooks/admin/useAdminBadges.ts`
Read a small map of "last seen" timestamps from localStorage and pass them all through in one call:

```
admin_users_last_seen
admin_listings_last_seen
admin_refunds_last_seen
admin_transactions_last_seen
admin_contact_last_seen
admin_waitlist_last_seen
admin_brands_last_seen  (existing)
```

Expose a helper `markAdminTabSeen(tab)` that writes `Date.now()` under the matching key and calls `refresh()` so the badge disappears instantly.

### 3. Mark-as-seen on tab open
Call `markAdminTabSeen` on mount in each of these admin pages:
- `src/pages/admin/AdminUsers.tsx`
- `src/pages/admin/AdminListings.tsx`
- `src/pages/admin/AdminRefunds.tsx`
- `src/pages/admin/AdminTransactions.tsx`
- `src/pages/admin/AdminBrands.tsx` (swap its existing inline localStorage write for the shared helper)
- `AdminContactSubmissions` and `AdminWaitlist` views (whichever component renders those tabs — I'll grep at build time).

Result: opening a tab records "seen now", the badge drops to 0, and it only comes back when new rows land after that timestamp. No schema changes, no per-row "mark read" UI needed — matches the way admin already treats Brands.

### Not in scope (say the word and I'll add it)
- A visible "Mark all as seen" button in each admin tab header (right now the visit itself is the mark).
- Server-side per-admin "seen" tracking (currently stored per device via localStorage — fine for a single admin, cross-device it'd need a table).

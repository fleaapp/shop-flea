## Goal
Ensure that when a listing is deleted (or status changes to `removed`/`archived`/`sold`), every user's app removes it from view within seconds — without needing a manual refresh or reopen.

## Why it happened this time
The demo listings persisted in the app because:
1. Home feed, wishlist, cart and profile queries are fetched once on mount and cached in React Query.
2. There is no Supabase Realtime subscription on the `listings` table, so clients never learn about deletes.
3. Locally-cached snapshots (wishlist/cart) keep showing the item with a "removed" overlay indefinitely.

## Plan

### 1. Enable Realtime on `listings`
- Add `listings` to the `supabase_realtime` publication so INSERT/UPDATE/DELETE events broadcast to subscribed clients.
- Set `REPLICA IDENTITY FULL` so DELETE payloads include the row id (needed to remove from caches).

### 2. Global listings realtime hook
- Create `src/hooks/useListingsRealtime.ts` mounted once at the app root (inside `App.tsx` under the auth provider).
- Subscribes to `postgres_changes` on `public.listings` and, on each event:
  - **DELETE** or **UPDATE where new.status ∈ ('removed','archived','sold','blocked')**: invalidate the React Query keys that surface listings (`['home-feed']`, `['wishlist']`, `['cart']`, `['profile-listings', userId]`, `['listing', id]`, `['search', ...]`).
  - Also surgically remove the affected `id` from any active infinite-query cache pages so the item disappears instantly without a full refetch flicker.

### 3. Client-side snapshot cleanup
- The localStorage "removed items" snapshot (wishlist/cart ⛔️ overlay) currently keeps sold/deleted items visible forever.
- On the same realtime event, purge that snapshot entry when the listing is hard-deleted (as opposed to sold), so demo/moderation deletions vanish rather than leaving a tombstone.

### 4. Refetch on app focus / resume
- Add `refetchOnWindowFocus: true` and a Capacitor `App.addListener('appStateChange', ...)` handler that calls `queryClient.invalidateQueries()` for listing keys when the native app returns to foreground. This is the safety net for users who were offline when the realtime event fired.

### 5. Verify
- After deploy: delete a test listing from the DB, confirm it disappears within ~2s on a second logged-in device without any manual refresh.
- Confirm the same for `status → removed` via the moderation trigger path.

## Technical notes
- Realtime subscription must be created after the Supabase auth session is available and torn down on unmount to avoid duplicate channels.
- Use a single shared channel (`listings-global`) rather than per-component subscriptions to stay well under Supabase's channel limits.
- No schema changes to `listings` itself — only publication + replica identity.

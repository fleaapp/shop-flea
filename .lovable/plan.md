## Problem

The admin User Management list reads from the external `profiles` table. When you delete a user in Supabase's auth dashboard, `auth.users` is removed but the `public.profiles` row is left behind (no `ON DELETE CASCADE`), so those ghost users keep appearing in the admin dashboard. There's also no realtime subscription, so even legitimate profile deletes don't update the list until a manual refetch.

## Fix

### 1. Reconcile the profiles table with auth.users (external DB)

- Add `ON DELETE CASCADE` to `public.profiles.user_id → auth.users.id` so future auth deletions clear the profile automatically.
- Run a one-time cleanup deleting any `profiles` rows whose `user_id` no longer exists in `auth.users`.

### 2. Filter ghost users at read time (defense in depth)

Update `supabase/functions/admin-data/index.ts` → `listUsers`:
- After loading `profiles`, call `supabase.auth.admin.listUsers` (paginated) and build a Set of live auth ids.
- Drop any profile whose `user_id` is not in that Set before enriching / returning.

This ensures deletions done directly in the Supabase auth UI immediately disappear from the admin view even if the cascade hasn't fired.

### 3. Live updates in the admin UI

Update `src/hooks/admin/useAdminUsers.ts`:
- Subscribe (via the external Supabase client) to `postgres_changes` on `public.profiles` for `INSERT`, `UPDATE`, `DELETE` and call `load()` on any event (debounced ~500 ms).
- Enable Realtime replication for `public.profiles` on the external DB (`ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles`) if not already on.

### 4. Verify

- Delete a test user in the Supabase auth dashboard, confirm it disappears from Admin → Users within a second without a manual refresh.
- Confirm counts (`stats.total`, etc.) update live.

### Technical notes

- Realtime subscription must be created inside `useEffect` and torn down on unmount to avoid the reconnection-loop billing issue.
- The `auth.admin.listUsers` reconciliation caps at ~1000 users per page; paginate until exhausted, cache the id Set for the request lifetime.
- No client-side type changes needed; `AdminUser` shape stays the same.

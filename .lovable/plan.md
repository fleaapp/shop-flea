## Problem

On native, tapping the Pause Selling toggle in Settings flips on visually then instantly reverts to off. The DB write appears to silently fail (or return zero rows) while the toast success/error path masks the outcome, and the controlled `Switch` re-reads `profile.pause_selling` (still `false`) after `refreshProfile()`.

Code review confirmed the wiring is otherwise sound: RLS `UPDATE` policy on `profiles` allows `auth.uid() = user_id`, `pause_selling` column exists (boolean, default false), `profiles_update_guard` does not block `pause_selling`, and the Switch is fully controlled by `profile.pause_selling` fetched via `refreshProfile()`.

## Fix

Update `handleTogglePauseSelling` in `src/pages/Settings.tsx` to:

1. Chain `.select('pause_selling').single()` onto the update so we can detect a silent zero-row response (RLS/session mismatch) and surface a real error.
2. Optimistically update local `profile` state via a new `setProfile` exposed from `AuthContext` (or via a targeted `refreshProfile` that awaits and returns the row) so the Switch reflects the persisted value immediately, without a flash of the stale value.
3. On error (including zero-row response), revert and toast the actual error message so we can see what's happening on native.

## Technical details

- `src/pages/Settings.tsx` — replace update call with:
  ```ts
  const { data, error } = await supabase
    .from('profiles')
    .update({ pause_selling: checked })
    .eq('user_id', user.id)
    .select('pause_selling')
    .single();
  if (error || !data) throw error ?? new Error('No row updated');
  await refreshProfile();
  ```
- `src/context/AuthContext.tsx` — no schema change; already awaits `fetchProfile`. If the diagnostic reveals a session/auth-uid mismatch on native, add a `supabase.auth.getSession()` refresh before the update.
- Keep the Switch controlled by `profile.pause_selling`; no optimistic-only local state.

Once the diagnostic toast confirms whether the failure is RLS (zero rows) vs. a thrown error vs. a stale-profile read, apply the targeted fix in the same pass.

# Remove the green screen gap between password setup and the walkthrough

## What's actually happening

Saving the password fires several auth events in a row: two `updateUser` calls (password, then `password_set` metadata), then a session refresh. Every one of those events makes the auth context flip back into a global "loading" state.

While that global loading flag is true, the home route unmounts the whole screen and renders a bare spinner on the app's lime background - that's the green screen. When loading finishes, the home screen mounts again from scratch and re-fetches the feed before the walkthrough can appear. The more round trips, the longer the green gap.

## Fix

1. Stop treating post-sign-in account updates as a full app reload.
   - Only enter the blocking loading state when there is no user yet (first sign-in / cold start).
   - `USER_UPDATED` and `TOKEN_REFRESHED` for an already-signed-in user refresh the profile quietly in the background, leaving the screen mounted.

2. Trim the password step's round trips.
   - Save the password and the `password_set` flags without the extra `getUser` hop and without the redundant `refreshSession()` call afterwards.
   - Advance to the walkthrough stage as soon as the password write confirms, and let the profile refresh finish in the background.

3. Hand over without a blank frame.
   - The walkthrough opens on the frame after the password dialog closes (existing behaviour), so with the screen no longer unmounting the transition becomes dialog -> walkthrough with the feed visible behind it.

## Result

Password saved -> dialog closes -> walkthrough appears immediately. No spinner, no lime screen, no home-feed refetch in between.

## Technical scope

- `src/context/AuthContext.tsx` - gate `setLoading(true)` on "no current user" instead of on event type.
- `src/components/PasswordSetupDialog.tsx` - single update path, no `getUser` hop.
- `src/pages/Index.tsx` - set the walkthrough stage before awaiting `refreshProfile()`, drop `supabase.auth.refreshSession()`.

No database or edge function changes.

# Notifications dropdown in Settings

Turn the Notifications row into an expandable dropdown (like Help Centre) containing both toggles.

## What changes

1. **Settings > General**: the "🔔 Notifications" row keeps its emoji but becomes expandable - a chevron that rotates down when opened, matching the Help Centre pattern already used lower on the page.
2. **Inside the dropdown**, two nested rows:
   - **Push notifications** - the exact toggle currently sitting on the Notifications row, same behaviour (native permission request, device token check on app resume, iOS/browser "turn it off in system settings" toast when switching off).
   - **Marketing emails** - the toggle currently in Edit Profile, same behaviour (writes `marketing_opt_in`, optimistic with revert on failure and a success toast).
3. **Edit Profile**: the Marketing emails block is removed so the setting lives in one place.
4. Guests keep the same handling they have today.

## Technical notes

- All changes stay in `src/pages/Settings.tsx`; no new route or page.
- Add `notificationsExpanded` state and set the Notifications item to `expandable: true` with nested children rendered the same way Help Centre renders `helpCentreItems`.
- Existing `notificationsEnabled` state, the `getPushPermissionAsync`/`push-status` sync effect, the `appStateChange` listener and `handleToggleNotifications` are reused unchanged for the Push notifications child row.
- Move the marketing opt-in state and update logic out of `src/pages/EditProfile.tsx` (around lines 56-57, 81, 403-427) into `Settings.tsx`, seeding the initial value from the auth profile.

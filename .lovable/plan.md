# Notifications settings screen

Turn the Notifications row in Settings into a navigable screen that holds both notification toggles.

## What changes

1. **Settings > General**: "Notifications" becomes a normal row with a chevron that opens a new Notifications screen (no inline toggle).
2. **New Notifications screen** (`/settings/notifications`), styled like the rest of Settings (centered header, back chevron, card rows):
   - **Push notifications** - the exact toggle currently in Settings, same behaviour (native permission request, device token check on app resume, iOS/browser "turn it off in system settings" toast when switching off).
   - **Marketing emails** - the toggle currently buried in Edit Profile, same behaviour (writes `marketing_opt_in`, optimistic with revert on failure and success toast).
3. **Edit Profile**: the Marketing emails block is removed so the setting lives in one place only.
4. Guests keep the same handling they have today (prompted to sign in where the current toggles require an account).

## Technical notes

- New file `src/pages/NotificationSettings.tsx`; route registered in `src/App.tsx` alongside `/settings/profile`.
- Move the `notificationsEnabled` state, the `getPushPermissionAsync`/`push-status` sync effect, the `appStateChange` listener and `handleToggleNotifications` out of `src/pages/Settings.tsx` into the new page unchanged.
- Move the marketing opt-in state and update logic out of `src/pages/EditProfile.tsx` (lines around 56-57, 81, 403-427) into the new page, reading the initial value from the auth profile.
- Reuse the existing Settings row markup (rounded-2xl card, `Switch` with charcoal/lime variant) so the visuals match.

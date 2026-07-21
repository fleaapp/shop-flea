## Plan

1. **Make the Settings footer badge use one canonical admin count**
   - Move the total calculation into `useAdminBadges` so every screen uses the same 12 admin categories: support, reports, bans, suggestions, waitlist, contact, transactions, refunds, listings, users, brands, and error logs.
   - Replace the separate totals in `BottomNav` and `Settings` with this shared `total` value.

2. **Stop the flashing/glitching**
   - Keep the previous badge value while a refresh is in flight instead of briefly rendering `0` or an incomplete total.
   - Avoid mounting separate admin-badge fetchers for the footer and Settings page; one hook instance per component should provide stable values.
   - Coalesce realtime/focus/seen updates through the existing debounce so multiple backend events cannot cause badge flicker.

3. **Align the badge UI with the admin dashboard**
   - Use the same badge sizing behavior as the Admin Dashboard: fixed height, minimum width, horizontal padding, and `99+` for large counts.
   - Apply this to the footer Settings badge and the Settings-page Admin Dashboard row badge so counts do not appear off-centre or cramped.

4. **Verify**
   - Check the footer Settings badge and the Admin Dashboard category totals use matching count sources.
   - Verify the badge remains visually stable during focus/refetch/realtime updates and does not disappear unless the true count is zero.
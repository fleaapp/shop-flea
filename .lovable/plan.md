## Plan

1. **Make order chat read state authoritative**
   - Update the order-message read endpoint so it marks all real order rows in a grouped order as read.
   - Also clear related message notifications even when `related_order_id` points to either the group id or an individual order id.
   - Return the number of messages/notifications cleared so the app can verify the clear actually happened.

2. **Clear badges immediately when opening message threads**
   - Add a shared helper for opening order chats from Orders, Sales, Order details, Sale details, and Alerts.
   - Before navigating, optimistically clear the visible buyer/seller chat badges for that order group, then let the backend read endpoint confirm it.
   - Keep message alerts routing to chat, while non-message order/sale alerts continue opening the relevant details drawer.

3. **Fix support chat badge persistence**
   - Make support-thread reads update both support messages and their linked support notifications.
   - Optimistically clear the Settings/support badge when a support thread opens, then refetch `nav-badges`, `unread-support`, and notifications.
   - Ensure the support unread hook always refetches on mount/focus so it doesn’t reuse stale cached counts after returning.

4. **Stop admin dashboard notifications from returning after login**
   - Move admin “seen” state from device-only localStorage to backend-backed admin preferences/metadata via the existing admin function.
   - Keep localStorage only as an instant UI cache, but have `getBadges` use backend saved timestamps so counts stay cleared after logout/login or across devices.
   - Mark support/reports/bans/suggestions sections as seen when opened, matching the existing users/listings/refunds behavior.

5. **Validate against current data**
   - Confirm `@jcsbh`’s current 4 unread buyer messages clear after opening the matching chats.
   - Confirm support chat and admin badge counts remain cleared after a fresh login/refetch.
   - Check that new messages still create exactly one unread badge for the recipient.
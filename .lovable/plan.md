## Plan

1. **Make chat read actions reliable**
   - Replace the failing order-chat read request path with a robust helper that can clear all rows for an order group and does not depend on one flaky `PATCH /order-messages` call succeeding before the user taps back.
   - When a buyer/seller chat opens, mark both the underlying `order_messages` rows and matching bell notifications as read using every known identifier: group id, individual order ids, and listing id fallback.

2. **Stop badges snapping back after refetch**
   - Update the buyer/seller unread hooks and bottom-nav badge logic so grouped orders are counted and cleared consistently.
   - Invalidate/refetch the exact query keys after read completion, and keep the optimistic UI clear while the backend read action finishes.

3. **Fix support chat badge persistence**
   - Route support read clearing through the existing backend read function consistently.
   - Ensure support notifications and support message rows are both cleared when opening the support chat, including fallback notification rows generated from unread support messages.

4. **Fix admin dashboard badges returning after login**
   - Use the admin backend function as the single persistence path for “last seen” timestamps instead of relying on direct client table writes/localStorage.
   - Mark admin sections as seen from every admin entry route, then reload backend-backed timestamps before badge calculation so logout/login does not restore the old counts.

5. **Validate the failing paths**
   - Confirm the current network failure around `order-messages` read is gone.
   - Verify opening an order chat, sale chat, support chat, and admin section clears the visible badge and keeps it cleared after refetch/navigation.
## Goal

Two changes in `src/components/BottomNav.tsx`, both fully live:

1. **Non-admin footer badges must mirror the counts each destination page shows.**
2. **Admin Settings badge additionally rolls up the important admin queue items** (support, refunds, reports, brand management, contact, bans).

Nothing else in the footer changes.

## Fix

### A. Mirror page counts for Cart / Profile / Alerts

Currently the footer pulls buyer/seller/activity numbers from the `get_nav_badges` RPC, which counts individual orders and uses `is_read`. The pages count **order groups** and use a **"seen since dismiss"** timestamp for alerts, so numbers drift apart.

In `BottomNav.tsx`, replace the RPC-derived math with the exact hooks each page uses:

- `useOrders()` → `buyerOrderGroups`, `sellerOrderGroups`
- `useUnreadOrderMessages()` → `perOrder`
- `useNotifications()` → `badgeCount` (already the "unseen since dismiss" number rendered on the Alerts page)
- Keep `useNavBadges()` only for `unread_support`.

Compute:

```ts
// Cart — mirrors src/pages/Cart.tsx ordersBadgeCount
const activeBuyerGroups = buyerOrderGroups.filter(g => g.status === 'awaiting' || g.status === 'shipped');
const cartUnread = activeBuyerGroups.reduce(
  (s, g) => s + g.orders.reduce((n, o) => n + (perOrder.get(o.id) || 0), 0), 0);
const ordersBadge = activeBuyerGroups.length + cartUnread;

// Profile — mirrors src/pages/Profile.tsx salesBadge
const toShip = sellerOrderGroups.filter(g => g.status === 'awaiting').length;
const sellerUnread = sellerOrderGroups.reduce(
  (s, g) => s + g.orders.reduce((n, o) => n + (perOrder.get(o.id) || 0), 0), 0);
const salesBadge = toShip + sellerUnread;

// Alerts — mirrors src/pages/Notifications.tsx
const alertsBadge = notificationBadgeCount;
```

Liveness comes from the hooks themselves: `useOrders` subscribes to `orders` + `order_messages` realtime, `useUnreadOrderMessages` subscribes to `order_messages`, `useNotifications` subscribes to `notifications` and listens for the `alerts-badge-dismissed` window event so tapping into Alerts instantly clears the footer.

### B. Admin-aware Settings badge

Extract the Settings tab into an internal `SettingsNavItem` component so admin hooks only run once and never on non-admin devices.

Inside:

```ts
const { isAdmin } = useAdminRole();
const { badges: admin } = useAdminBadges(); // only used when isAdmin

const settingsBadge = isAdmin
  ? (admin.support + admin.reports + admin.refunds + admin.brands + admin.contact + admin.bans)
  : navBadges.unread_support;
```

The "important" admin extras are: **support, refunds, reports, brand management, contact, bans**. Deliberately excluded: `suggestions`, `waitlist`, `listings`, `users`, `transactions` (informational, would inflate the badge). `useAdminBadges` already subscribes to `chat_messages`, `reports`, `orders`, `listings`, `contact_submissions`, `waitlist`, `profiles`, `brands`, `notifications` realtime, so admin counts update live.

Only render / call `useAdminBadges` when `isAdmin === true` (gate via early return in a child component) so non-admin users never open those channels.

## Out of scope

- Any visual/style change to the badge.
- Backend `get_nav_badges` RPC (left as-is; we simply stop using its buyer/seller/activity fields in the footer).
- Admin Dashboard chips themselves.

## Technical notes

- `useOrders`, `useUnreadOrderMessages`, `useNotifications` are React Query hooks with stable keys, so mounting them in the always-present `BottomNav` dedupes with the same hooks used on Cart/Profile/Notifications pages — no extra network beyond the initial fetch per session.
- `useAdminRole` returns cached admin status; a single edge-function check per session.
- `notificationBadgeCount` is exactly the number rendered on the Alerts page header, so dismiss actions there clear the footer simultaneously via the existing `alerts-badge-dismissed` event.
- No SQL/migration changes required — every subscription used here is already functional in the app today.

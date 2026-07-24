## Goal
Tapping a push notification (native iOS or web) should open the same destination as tapping the notification inside the Alerts page — sale/order details drawer for sales/orders/refunds/shipping, chat for messages, listing page for listing-only alerts.

## Approach
Route every push tap through the Alerts page with a query param that tells it which notification to auto-open. The existing click handler in `src/pages/Notifications.tsx` already knows how to open the right drawer, chat, or listing for every notification type — we just replay it.

## Changes

**1. `src/pages/Notifications.tsx`** — auto-open a notification on mount when the URL carries `?open=<type>&order=<id>&listing=<id>&thread=<id>` (any subset). Match the first notification in the list whose type + related ids line up, run the existing click handler, and strip the params via `history.replaceState` so refresh doesn't re-trigger.

**2. `public/push-sw.js`** (web push) — replace the current per-type navigation with a single `/notifications?...` route built from the payload's `type`, `related_order_id`, `related_listing_id`, `related_thread_id`. Keep the existing focus/openWindow behaviour.

**3. `src/hooks/useNativePushNotifications.ts`** (iOS) — add a `pushNotificationActionPerformed` listener. Read `notification.data`, build the same `/notifications?...` URL, and navigate to it via a small event → React Router bridge (dispatch a `CustomEvent('flea-open-notification', { detail: url })` that a listener mounted in `App.tsx` translates into `navigate(url)`). Also handle a foreground `pushNotificationReceived` tap fallback where relevant.

**4. `src/App.tsx`** — mount a one-line effect that listens for `flea-open-notification` and calls `navigate(detail)` inside the Router context.

No backend changes: `send-push-notification` already includes `type`, `related_listing_id`, `related_order_id`, `related_thread_id` in both APNs and web payloads.

## Edge cases
- If the target notification isn't in the current page's list yet (e.g. cold start before fetch), retry once after the notifications query settles.
- Message-type alerts still land on the chat because that's what the Alerts page click handler does for them.
- Refund/shipping/sale/order alerts open the corresponding SalesDetailsSheet or OrderDetailsSheet inline, exactly as they do when tapped in the Alerts list.
- Cold-start on native: the listener fires after React mounts because Capacitor queues the event; the Alerts page's mount-time auto-open handles it.
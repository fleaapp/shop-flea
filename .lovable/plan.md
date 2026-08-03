## Offers polish + audit fixes

### What I confirmed
- The 24-hour pay window already exists in the backend: accepting an offer sets `expires_at = now() + 24h`, drops the item into the buyer's cart, and an hourly cron (`expire-stale-offers`) expires accepted-but-unpaid offers. Checkout looks the price up server-side. So the rule works - it's just barely communicated in the UI.
- Offer notifications are written with types `offer_received`, `offer_accepted`, `offer_auto_accepted`, `offer_declined`, `offer_countered`, `offer_discount`. None of these are handled in `getNotificationMessage` / `getNotificationEmoji` or in the realtime toast title map, so they fall through to the generic "New notification" / 🔔.

### 1. Offers screen UI
- Center the header: back chevron absolutely positioned left, "💰 Offers" centred, matching other screens.
- Replace the ad-hoc empty block with the shared `EmptyState` component, vertically centred in the scroll area (emoji 💰, clear title + description, and a "Browse items" action on the Sent tab).
- Add a loading state that matches the rest of the app instead of the lone hourglass.

### 2. Notification copy (the real fix for "New notification")
- Add all `offer_*` types to `getNotificationMessage` and `getNotificationEmoji` (💰 offers, 🎉 accepted, 😔 declined, 🔁 countered, 🏷️ discount), always preferring the rich `rawMessage` written by the edge function.
- Add the same types to `ALERT_TITLES` in `RealtimeAlerts.tsx` so in-app toasts read "💰 New offer" etc.
- Add the types to the `NotificationType` union.

### 3. Make the 24-hour pay window obvious
- Accepted-offer card on the Offers screen: countdown pill ("Pay within 23h") plus the existing Pay button, and a clear "Expired - offer no longer valid" state once past.
- Cart: keep the per-item 💰 badge, and add a single line above the checkout button when any cart item has an accepted offer: "💰 Offer price locked for Xh - pay before it expires."
- Checkout: same reminder line above the pay button, so the deadline is visible at the point of payment.
- Copy in `MakeOfferDrawer` updated to state both windows: seller has 24h to reply, buyer has 24h to pay after acceptance.

### 4. Audit fixes found while reading the flow
- Offers screen currently refetches listings on every `all` change (new array each render) - memoise the id lists so it stops re-querying in a loop.
- Sort each tab so live offers appear above closed ones, and show closed offers in a muted style.
- Show the listing's live status on the card (Sold / Removed) when the item is no longer active, so a stale accepted offer isn't confusing.
- Toast copy after accepting a seller-side offer will state the buyer's 24-hour pay window explicitly.

### Technical notes
Files touched: `src/pages/Offers.tsx`, `src/hooks/useNotifications.ts`, `src/components/RealtimeAlerts.tsx`, `src/components/MakeOfferDrawer.tsx`, `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`. No database or edge-function changes needed - the offer lifecycle, expiry cron and server-side price authority are already correct.

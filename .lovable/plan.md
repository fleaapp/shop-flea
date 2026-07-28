# Deep audit — findings & suggested fixes

Ran live queries across orders, payments, notifications, push, errors, security. Grouped by severity. **P0 = fix now, P1 = fix soon, P2 = nice-to-have.**

---

## 🔴 P0 — Fix now

### 1. Only 1 user in the whole app has push notifications set up
- `push_subscriptions` table has exactly **1 row** — `@jcsbh` on iOS.
- `@sarahhearn2` has **no push subscription at all**, which explains every "I'm not getting notifications" complaint from her.
- **Root cause candidates:** she never granted iOS permission, OR the register-push edge function failed silently, OR her old token was reclaimed by another install and never re-registered.
- **Fix:** on app launch, if user is signed in and iOS permission is `granted` but no row exists in `push_subscriptions`, force-re-register. Add a visible "Notifications: Off — tap to enable" banner in Settings when the row is missing.

### 2. Five orders sitting in `awaiting` for 6 days, no shipment
- FL-001003 → FL-001007, all placed 22 Jul, none have `shipped_at`, none have tracking.
- The 3-day and 6-day seller reminders should have fired — the seller only has web sessions and no push subscription, so those went nowhere.
- The new buyer overdue alert (day 4) also won't reach the buyer without a push subscription.
- **Fix:** verify the `shipping-reminders` cron actually ran on 25 Jul & 28 Jul (check edge function logs). If it did, confirm the notifications rows were inserted for these orders — they're the canary. Also add an in-app red banner on Seller Dashboard when any awaiting order is >3 days old, since push clearly isn't reliable.

### 3. Two July-21 refunds have no Stripe reconciliation record
- FL-001001 and FL-001002: `refund_reason = 'seller_refund'`, both refunded within an hour of purchase.
- `payment_events` table has zero rows (RLS blocks reads even for service_role via the API — needs a direct check).
- **Fix:** either backfill the payment_events rows from Stripe, or add a nightly reconciliation job that flags refunds without a matching `charge.refunded` webhook.

### 4. Repeat client crashes from stale JS bundles
- `error_logs` shows 6 recent crashes with messages like `Can't find variable: formatTime` and `Can't find variable: anyStillClearing`. These are classic **stale service worker / cached chunk** errors after a deploy.
- The `staleChunkRecovery.ts` we added handles some cases but is clearly not catching everything.
- **Fix:** widen the recovery regex to also match `Can't find variable` (Safari's phrasing), and add a version-check ping every 60s that force-reloads when a new build is detected.

---

## 🟠 P1 — Fix soon

### 5. Alert bell badge doesn't count newer notification types
- `useNavBadges` returns `activity_unread` from a hardcoded set of types. New types added recently (`order_overdue_buyer`, `refund_requested`, `refund_declined`, `refund_approved`, `tracking_rejected`, `payment_action_required`) may not all be included.
- **Fix:** switch the RPC to count all `notifications` rows where `is_read = false`, not a whitelist.

### 6. `OrderDetailsSheet` intermittent crash on notification deep-link
- Render crash from 28 Jul (React error #310 = "Rendered more hooks than during the previous render") — this is the drawer opening before data is loaded.
- **Fix:** move all hook calls above the early `if (!orders) return null` guard, and put the null check just before the JSX return.

### 7. Delivered order dispute window is off
- FL-001009 delivered 28 Jul, dispute window ends **30 Jul** (48h) — matches spec ✅
- But `admin_marked_delivered = false` and `shipped_at = delivered_at` (auto-backfilled by `mark_order_delivered`). Seller never actually entered tracking, so the "seller payout gated on tracking" rule is currently bypassed here.
- **Fix:** when buyer marks delivered without tracking, flag the order for admin review before releasing payout, instead of auto-completing.

### 8. 80 Supabase linter findings — real ones
Ignore the 60+ that are our whitelisted SECURITY DEFINER helpers. Real ones to act on:
- **RLS enabled, no policy** on 3 tables (likely `saved_searches`, `payment_events`, `rate_limits`) — either add policies or explicitly grant only to `service_role`.
- **Extension in public schema** — `pg_net` or `pg_cron` installed in `public`; low risk but should move to `extensions`.
- **Permissive RLS `USING (true)`** on an UPDATE/DELETE/INSERT policy somewhere — needs identifying and scoping.
- **Public storage bucket allows listing** — someone could enumerate all filenames in `listings` bucket. Restrict `storage.objects` SELECT to authenticated users only.

### 9. Coupon `FREEFLEA` never used
- 0 redemptions since launch. Either nobody has tried, or the checkout UI doesn't surface it clearly enough.
- **Fix (UX):** add a "Have a code?" link on checkout that expands the coupon field, and log failed redemption attempts so we can see if people are trying.

---

## 🟢 P2 — Nice to have

### 10. Reports table is empty
- No moderation reports have ever been filed. Either the report flow is broken or nobody has needed it. Worth a manual test.

### 11. Only 1 completed order in history
- After weeks of testing there's only 1 `completed` order. The 48h dispute window + auto-complete cron should be graduating delivered → completed. Verify the cron is scheduled.

### 12. Error logging is client-only
- `error_logs.source` only shows `'client'`. Edge functions currently console.log but don't write to this table, so we're blind to server-side crashes.
- **Fix:** add a shared `logError()` helper for edge functions that writes to `error_logs` too.

---

## What I'd fix in the next build turn (proposed order)

If you approve, I'd tackle these in one pass, in this order:
1. **#6** — order details crash (5 min, blocks users from opening drawers)
2. **#1** — force push re-registration + Settings banner (blocks half your notification complaints)
3. **#5** — badge counter uses `is_read` (removes badge desync)
4. **#4** — widen stale-chunk recovery (stops crash loops after deploys)
5. **#2** — Seller Dashboard "overdue orders" banner + verify cron logs
6. **#7** — gate no-tracking deliveries behind admin review
7. **#8** — the 4 actionable linter findings
8. **#3 + #12** — reconciliation job + edge function error logging

**Skipped for now:** #9 (UX, wants your call), #10 (needs manual test), #11 (needs cron verification first).

Reply with which numbers to do, or "all P0+P1" and I'll batch them.

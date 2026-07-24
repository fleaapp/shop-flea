## 1. Review notifications open the Reviews drawer

Today `new_review` notifications fall through to the generic branch in `src/pages/Notifications.tsx` (line ~263) and navigate to `/listing/:id`, so the user has to hunt for their new review.

Change:
- In `handleNotificationClick`, add an explicit branch for `notification.type === 'new_review'` that navigates to `/profile` with router state `{ openReviews: true }` (own profile — the reviewed user is always the current user).
- In `src/pages/Profile.tsx`, on mount read `useLocation().state?.openReviews` and, when true, `setReviewsOpen(true)` then clear the state via `navigate('.', { replace: true, state: {} })` so it doesn't re-trigger on back navigation.

No copy or design changes; the existing `ReviewsDrawer` is what opens.

## 2. Make chat feel instant

Sending is already optimistic (the bubble appears immediately on tap), so the perceived 5-second delay is the *load* of the chat: `OrderChat` fetches the full message list through the `order-messages` edge function, which pays a cold-start + network round-trip every time the chat opens. Same story for `ChatConversation` (support).

Change:
- Replace the initial GET-through-edge-function with a direct `supabase.from('order_messages').select(...)` (RLS already restricts to buyer/seller). This removes the edge-function cold start from the open-chat path — typically 200–800 ms instead of 3–5 s.
- Keep the existing Realtime channel and the 30 s safety refetch. Keep POST-through-edge-function for sends (it does auth checks + push fan-out).
- Mark-as-read stays on the existing RPC (`mark_order_thread_read`), fired in the background — not awaited before rendering.
- Apply the same swap in `src/pages/ChatConversation.tsx` for support threads, reading `chat_messages` directly.
- Warm the message cache when the chat card is tapped: in the Orders/Sales list, on tap prefetch `['order-messages', orderId]` via `queryClient.prefetchQuery` so by the time the chat route mounts the data is usually already there. Small, isolated change in the two list pages that navigate into chat.

### Technical notes
- `order_messages` RLS: confirm buyer/seller SELECT policy exists before switching (schema shows 3 policies on the table). If a policy is missing for the reader, add it in a follow-up migration — not part of this plan unless the check fails.
- No schema changes.
- No UI/design changes to the chat itself; only the data source changes.

## Files touched
- `src/pages/Notifications.tsx` — add `new_review` branch.
- `src/pages/Profile.tsx` — open Reviews drawer from router state.
- `src/pages/OrderChat.tsx` — direct DB read for initial load + prefetch key export.
- `src/pages/ChatConversation.tsx` — direct DB read for initial load.
- `src/pages/Sales.tsx`, `src/pages/Cart.tsx` (order list) — prefetch on tap.

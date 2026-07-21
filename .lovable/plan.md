## Bug
After the cloud migration, buyer↔seller order chats look empty and refund requests don't appear — even though the messages are being written to the DB (verified: recent refund_request row `e284125a…` for order `94518d22…` exists). Support chat is unaffected because it queries `chat_messages` directly from the client.

## Root cause
On the old external DB, `order_messages` had an `order_group_id` column. On Cloud it doesn't — only `order_id`. `supabase/functions/order-messages/index.ts` detects this via `getOrderMessageKey()` and caches `"order_id"`.

When a user opens a chat from Cart/Sales the URL contains the `order_group_id` (Cart.tsx:250, Sales.tsx:103 both use `group.order_group_id || primaryOrder.id`). The edge function's read path (line ~721) then does:

```ts
requestedIdType === "group" && matchedOrderGroupId
  ? .eq(orderMessageKey /* = "order_id" */, matchedOrderGroupId)  // filters order_id by a GROUP id → 0 rows
  : ...
```

Same bug in the PATCH branch that marks messages read (~line 743). Inserts happen to work because `getThreadOrderId` resolves to `matchedOrderId` when the key is `order_id`, so rows get written under a real order id — but reads never find them again.

The frontend's realtime subscription in `src/pages/OrderChat.tsx` has the same shape:

```ts
filter: `order_id=eq.${orderId}`  // orderId is often the group id
```

So new messages don't push live either — the poll every 5s masks it a bit but only if the fetch worked.

## Fix (backend + one frontend tweak, no schema change)

1. **`supabase/functions/order-messages/index.ts`** — replace the group-branch filters so we always match by real order ids when the key is `order_id`:
   - Compute an `orderIds` array once per request: `relatedOrderIds` when present, else `[matchedOrderId]`, else `[requestedOrderId]`.
   - Read path: `external.from("order_messages").select("*").in("order_id", orderIds).order("created_at", { ascending: true })`. Keep the `order_group_id` branch only when `orderMessageKey === "order_group_id"` (harmless on old DBs).
   - PATCH read-update: same — `.in("order_id", orderIds)` when key is `order_id`.
   - `getThreadOrderId` unchanged.
   - Deploy immediately after saving.

2. **`src/pages/OrderChat.tsx`** — subscribe to all order ids in the group, not just the URL id:
   - Read `orderInfo`'s group from the `useOrders()` hook (already loaded there) to build `relatedOrderIds`.
   - If we have `relatedOrderIds`, subscribe with `filter: 'order_id=in.(id1,id2,…)'`; otherwise fall back to the existing single-id filter. Same channel key derived from a stable join of ids so we don't leak subscriptions.

## Refund requests specifically
No separate code path — refund system messages are inserted through the same `insertSystemMessage` → `insertOrderMessage` path that the read fix already covers. Once the read filter is correct they'll render in-line via the existing `RefundSystemMessage` component.

## Support messages
Verified `ContactSupport.tsx` / `ChatConversation.tsx` query `chat_messages` and `chat_threads` directly through the Cloud `supabase` client with intact RLS + realtime publication. No change needed. If the user reports a specific support-thread breakage after the fix above ships, I'll re-investigate with a targeted repro.

## Verification
- `code--exec` a curl to `order-messages?orderId=<group_id>` as user @sarahhearn2 (from `Authorization: Bearer <session token>`) and confirm the response `messages` array contains the recent refund_request row.
- Load the app, open an order chat from Sales for the group with the refund, and confirm the refund card + prior messages render.
- Send a new message; confirm it appears live for the other participant via the realtime subscription (no 5s wait).

## Out of scope
- Adding an `order_group_id` column to `order_messages` (bigger schema/migration change; not needed for the reported bug).
- Any RLS or grant changes — the current SELECT policy already scopes to `orders.buyer_id/seller_id` via `order_id`.

Three separate bugs surfaced by the screenshots. Fix each at the root.

## 1. Chat still shows Reject / Refund Order after a direct refund from Sale Details

**Cause.** `OrderChat` computes `hasSellerResponded` by scanning for a later `refund_initiated` / `refund_rejected` `order_messages` row. `stripe-connect-refund` (the path used from Sale Details) inserts push `notifications` rows but never posts a `refund_initiated` system message into the order thread, so the refund-request card stays actionable.

**Fix.**
- **`supabase/functions/stripe-connect-refund/index.ts`** — after the Stripe refund succeeds, insert an `order_messages` row for the order group with:
  - `message_type: 'refund_initiated'`
  - `sender_id`: seller_id (system-authored on their behalf)
  - `message`: JSON `{ type: 'refund_initiated', seller_username, payment_method: 'stripe', initiated_at }` — same shape `RefundSystemMessage` already renders.
  Guard with an existence check so we never double-insert.
- **`src/pages/OrderChat.tsx`** — client-side belt-and-braces: also treat `hasSellerResponded = true` when the underlying order (or any order in the group) has `status === 'refunded'`. This hides the buttons instantly even before the new system message round-trips or on legacy refunds with no system message.

## 2. Refund evidence image fails to load

**Cause.** `order-attachments` bucket was flipped to private in migration `20260518022131`, but `uploadRefundImages` still stores `getPublicUrl(path)` — those URLs 404 against a private bucket. Compounding it, the storage RLS policy assumes the path starts with `orderId/...` (`split_part(name, '/', 1)`) but the actual path is `userId/orderId/...`, so even authenticated fetches would fail.

**Fix.**
- **`supabase/functions/order-messages/index.ts` (`uploadRefundImages`)** — replace `getPublicUrl` with `createSignedUrl(path, 60 * 60 * 24 * 365)` (1-year signed URL). Store the signed URL in the message JSON `media` / `image_urls`. Signed URLs bypass RLS and render for both buyer and seller.
- **Migration** — correct the storage RLS policy `Order participants can read order attachments` to use `split_part(storage.objects.name, '/', 2)` (the real orderId segment). Belt-and-braces for any direct authenticated fetch and for older assets we may re-sign later.
- No client change needed; `RefundSystemMessage` already renders whatever URL is in `media` / `image_urls`.

## 3. Alerts show `@@jcsbh` on order messages

**Cause.** DB trigger `notify_on_order_message` (migration `20260315032425`) builds the message with `'@' || COALESCE(v_sender_username, 'buyer')`. `profiles.username` is stored with a leading `@` for many users, producing `@@jcsbh`.

**Fix — new migration** replacing `public.notify_on_order_message()`:
- Normalise the username before concatenation: `'@' || regexp_replace(COALESCE(v_sender_username, 'buyer'), '^@+', '')` for both the `order_message_seller` and `order_message_buyer` branches. No behaviour change for usernames stored without `@`.

## Out of scope
- Backfilling existing broken image URLs in old refund request messages (only affects records created before this fix; the specific existing test message will remain broken).
- Rewriting existing `@@` notifications already sitting in the DB.
- Any change to refund business logic, buttons, or copy.

## Verification
1. From @sarahhearn2 issue a refund via Sale Details for a fresh order → open the chat: refund-request card is replaced by a green "Refund Initiated" card; no Reject / Refund Order buttons.
2. From @jcsbh submit a new refund request with a live-camera photo → open chat as @sarahhearn2: the evidence thumbnail renders (signed URL loads).
3. Send a new order message from either side → the Alerts entry reads `@jcsbh` (single `@`), never `@@jcsbh`.

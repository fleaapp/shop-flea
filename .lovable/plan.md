# Multi-item Refund Requests

Currently a bundled order (multiple items from the same seller under one `order_group_id`) can only refund the whole bundle via `primaryOrder.id`. This adds per-item selection.

## Behaviour

- Buyer opens **Request Refund** from Order Details.
- If the order group has only one refund-eligible item, the flow stays as it is today (no picker).
- If it has 2+ items, a **Select items** step appears first:
  - Checkbox list of every item in the group that is still eligible (delivered, within 48h window, not already refunded/requested).
  - Each selected item gets its own **reason** dropdown (same 6 REFUND_REASONS as today) + optional per-item note.
  - Continue is disabled until every selected item has a reason.
- Next step is the existing shared proof capture (1–5 live photos/videos, camera-only). One proof set covers the whole request.
- Optional "Additional details" textarea remains, shared across the request.
- Submit fires one refund request per selected item (loop), all sharing the same proof set.

## Refund maths

Per-item refund amount = item `price` + that item's share of shipping.
Shipping share = `order.shipping_price` for that order row (each order row already stores its own shipping portion from checkout bundle math, so no re-splitting needed). Seller keeps shipping only for unrefunded items — matches current per-order model.

## Data / backend

No schema changes. Uses existing per-order refund pipeline:

- `order-messages` edge function `action=refund_request` — called once per selected item with the shared proof `image_uploads` and that item's `reason` + `details`.
- `request_refund` RPC — called per item with `p_order_id = <item>`, `p_order_group_id = group`, `p_reason = "<reason> - <note>"`.
- Seller sees each item as its own refund request in Sales / chat / admin dispute queue (already supported — the queue is per-order row).
- Auto-approval cron and 72h window already run per order row, so per-item requests inherit that behaviour.

Proof upload: to avoid re-uploading N times, `order-messages` is called with the same `image_uploads` payload for each item. (Storage cost is negligible: proof set capped at 5 files.) A later optimisation could upload once and pass URLs, but that's out of scope.

## UI changes

`src/components/RefundRequestDialog.tsx`
- Accept new props: `items: { orderId, title, image, price, shipping }[]` and `onSubmit({ selections: { orderId, reason, note }[], details, imageUploads })`.
- New first step "Select items" when `items.length > 1`: checkbox rows with thumbnail, title, price, inline `Select` for reason, small note input.
- Existing proof + details step becomes step 2 (single-item case skips straight to it with the sole item preselected).
- Header shows step indicator ("1 of 2 • Select items" / "2 of 2 • Add proof").
- Submit button disabled until: ≥1 item selected, every selected item has a reason, ≥1 proof captured.

`src/components/OrderDetailsSheet.tsx`
- Build the eligible items list from `orders` (filter out already refunded / already-requested rows).
- Replace the current `onSubmit` with a loop: for each selection, invoke `order-messages` refund_request + `request_refund` RPC. Aggregate errors; toast success only if all succeed, otherwise toast partial-failure with count.
- Invalidate the same query keys once at the end.

## Edge cases

- Single eligible item → picker is skipped; current UX preserved.
- Item already has a pending refund request → shown disabled in picker with "Requested" badge.
- Item already refunded → hidden from picker.
- All items already refunded/requested → Request Refund button is hidden (existing `canShowRefundButton` extended to require ≥1 eligible item).
- Partial submission failure → items that succeeded stay requested; toast reports "X of N submitted, please retry the rest".
- 48h window is evaluated per `delivered_at` (already per-order today) — the picker uses the same rule per item.

## Out of scope

- Splitting a single item's shipping across partial refunds.
- Uploading proof once and reusing URLs (future optimisation).
- Admin UI changes — the dispute queue already lists per-order rows.

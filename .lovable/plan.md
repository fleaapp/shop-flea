# Refund request: live-capture proof + full-flow confirmation

## 1. Require live-captured evidence (no gallery, no file uploads)

Update `src/components/RefundRequestDialog.tsx` so proof can only come from the live camera. Buyer must provide at least one live photo OR one live video before Submit is enabled. Copy updated to explain why (to prevent AI-generated or edited evidence).

**Native (Capacitor iOS/Android)** — use `@capacitor/camera` (already installed and used by `IdVerificationStep.tsx`):
- Photo: `CapCamera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Base64, quality: 70, allowEditing: false })`. `CameraSource.Camera` disables the "Photos" picker entirely.
- Video: `CapCamera.pickVideos` supports gallery, so instead use a hidden `<input type="file" accept="video/*" capture="environment">`. Inside the Capacitor WKWebView `capture` forces the system camera recorder and blocks the library. Limit to ~30 s / 25 MB post-compression.

**Web/PWA fallback** — hidden `<input capture="environment">` for both photo and video. On desktop browsers `capture` is ignored, so on non-mobile web we show a banner: "Refund proof must be captured on the Flea mobile app." and disable Submit. Detection via `navigator.userAgent` + Capacitor `isNativePlatform()`.

UI:
- Replace the current "Upload images (optional)" section with two live-capture buttons: "📸 Take photo" and "🎥 Record video".
- Rename section label to "Live proof (required)" with helper text: "Photos and videos must be captured live in the app. Uploads from your gallery are not accepted so we can verify authenticity."
- Each captured item shows as a thumbnail (video shows a play icon) with an X to retake. Up to 5 total.
- Submit stays disabled until `reason` is set AND at least 1 live capture exists.

Payload:
- Extend the existing `image_uploads` array to also carry videos: add `kind: 'photo' | 'video'` and `duration_seconds?` per item. Keep base64 transport (already used); videos compressed client-side, hard cap 25 MB per file, else toast and reject.
- Every captured item is tagged `capture_source: 'live_camera'` in the payload so the edge function and admin dashboard can display "Live capture ✅".

## 2. Backend: accept video attachments

`supabase/functions/order-messages/index.ts` refund_request handler:
- Extend the upload loop to accept `contentType: video/*` (currently image-only). Store under the existing `order-attachments` bucket path.
- Persist `capture_source` in the refund message metadata JSON so it flows through to `RefundSystemMessage` and admin views.
- No policy changes required — bucket is already private with the existing per-order access rules.

## 3. Confirm refund flow works for awaiting / shipped / delivered

Audit the three status paths and fix any gap found:

- **awaiting** (already tested by user) — buyer requests → seller approves → `stripe-connect-refund` reverses charge + application fee. Order flips to `refunded` via `enforce_refunded_order_status` trigger. Keep as-is.
- **shipped** — same request path is already reachable because `refundWindowExpired` in `OrderDetailsSheet.tsx` only trips after delivery + 10 days, and `canShowRefundButton` doesn't restrict by status. Verify `stripe-connect-refund` doesn't require `delivered_at`. Add a system message note "Shipped — buyer claims non-arrival/damaged" so seller sees context.
- **delivered** (within 10 days) — button already visible. Confirm `useOrders` / `OrderChat` route the refunded order correctly to the Refunded tab afterward and that the "Mark as delivered" action is hidden once refunded.

Verification steps after build:
1. Manually test all three statuses end-to-end in preview against a real test order.
2. Check `stripe-connect-refund` logs via `supabase--edge_function_logs` for each.
3. Confirm the order disappears from active buyer/seller lists and appears in Refunded, and the badge counters update.
4. Confirm sales details, notifications, and OrderChat all show refunded state consistently.

## Files touched
- `src/components/RefundRequestDialog.tsx` — live-capture UI, video support, gating.
- `supabase/functions/order-messages/index.ts` — accept video uploads + capture_source metadata.
- `src/components/RefundSystemMessage.tsx` — render "Live capture ✅" badge and video thumbnail with play button.
- `src/components/OrderDetailsSheet.tsx` — no functional change; verify refund button visibility for shipped/delivered.
- No DB migration required.

## Out of scope
- Server-side AI/deepfake detection on the video itself. We rely on the platform camera capture path to prevent gallery/AI uploads; a heavier authenticity check can be added later if needed.

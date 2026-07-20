## Fixes

### 1. Slow to post a comment
`addComment.mutationFn` awaits the DB insert, then still awaits the `comment-mentions` edge function whenever the text contains an `@`. The mentions call is what's making it feel slow.

- In `src/components/ListingComments.tsx`, resolve the mutation immediately after the DB insert. Fire the `comment-mentions` call as fire-and-forget (same pattern already used for push). No user-visible wait beyond the single insert round-trip.

### 2. Push not working (app-wide)
Two independent breakages combining to zero pushes:

- `send-push-notification` rejects non-service-role callers whose `user_id` isn't their own (403). So the client-side push in `ListingComments` targeting the listing owner always fails silently. Same architectural problem for any client-to-other-user push.
- The DB trigger `public.trigger_push_notification` reads `current_setting('supabase.service_role_key', true)`, which is `NULL` on this project. So the server-side path that fires on every `notifications` insert also silently no-ops.

Fix once, works for every notification type (comments, replies, mentions, order shipped/delivered, order messages, reviews, refunds, cart/wishlist sold, support, etc.), because every one of those already writes into `public.notifications`:

- Migration: add a `push_service_role_key` entry to `vault.secrets` (value = the project service role key) and rewrite `public.trigger_push_notification` to read the auth token from `vault.decrypted_secrets` — same pattern already working for `email_queue_dispatch` / `email_queue_wake`.
- Remove the now-redundant client-side `sendPushNotification` call in `ListingComments.tsx` to avoid double-sending.
- Leave `send-push-notification`'s 403 guard as-is (correct security posture).

### 3. Phone number slipped through
User confirmed the format was standard AU with spaces (e.g. `0412 345 678`). Current `detectPhoneNumber` in `src/utils/contentModeration.ts` requires either an 8+ digit run in normalized text OR one of the specific formatted patterns. Depending on separators used, the AU pattern can miss, and the `\d{8,}` branch only sees the digits still consecutive after `normalizeText` (which doesn't strip spaces).

- Tighten `detectPhoneNumber`:
  - Also test the "digits only" form: if `text.replace(/\D/g, '').length >= 7`, block.
  - Add a permissive AU regex: `/0[2-8](?:[\s\-._]?\d){7,9}/` (covers 04xx, 02/03/07/08 landlines with any separators).
  - Add a generic 7+ digits-with-separators regex: `/(?:\d[\s\-._]*){6,}\d/`.
- Keep existing patterns as fast-paths.

### Technical details
- Only files touched: `src/components/ListingComments.tsx`, `src/utils/contentModeration.ts`, plus one SQL migration.
- Migration steps:
  1. `INSERT INTO vault.secrets (name, secret) VALUES ('push_service_role_key', <service role key>) ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;` — value supplied via a one-shot edge-function seed (has `SUPABASE_SERVICE_ROLE_KEY`), not hardcoded in migration.
  2. `CREATE OR REPLACE FUNCTION public.trigger_push_notification()` replacing `current_setting(...)` with a `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_service_role_key'` lookup. Wrap in `EXCEPTION WHEN OTHERS` (already does).
- No changes to `send-push-notification` internals, so existing rate limits / stale-endpoint cleanup / APNs path continue to work.

### Result
- Comment post feels instant.
- Every notification (not just comments) sends a push via the single trigger path.
- `0412 345 678` and equivalent AU formats are blocked before insert.
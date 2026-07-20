
## What's actually broken

Your dad's comment **did** create a notification for @sarahhearn2 on the real (external) database — I can see the row `@jcsbh commented on your listing "Puma sneakers"` at 11:33 UTC today, plus two earlier ones and two `@mention` rows. So the app code and `notify_on_comment` are working. What's broken is everything downstream of the notification row.

Three concrete gaps on the production database (`dzglehiopfgfjmxtejve`):

1. **No push trigger exists on the `notifications` table.** The `trigger_push_notification` function and the three `AFTER INSERT` triggers we set up only live on the Lovable Cloud database, which never sees these inserts. On production, inserting a notification just… sits there. Nothing calls `send-push-notification`. That's why no push arrived for any of today's 5 notifications.

2. **`push_subscriptions.platform` column is missing on production.** The native iOS hook (`useNativePushNotifications`) inserts with `platform: 'ios'`, which throws a schema error on production, so **no APNs device token has ever been saved for your TestFlight build**. Every row in production `push_subscriptions` is a web/PWA endpoint (`web.push.apple.com/…`), not an APNs token. Even if the trigger fired, it would try to web-push to old PWA endpoints, not your native app.

3. **`push_service_role_key` is not seeded in production's vault.** The trigger reads that secret to authorize the call to `send-push-notification`. Without it, the trigger short-circuits with a warning.

Everything else (edge function, APNs credentials in Cloud secrets, `send-push-notification` code) is already correct — it just never gets called for production notification inserts, and there's no native token to send to anyway.

## Plan

### 1. Migrate the missing schema + trigger to production
Run one migration against the external database that:
- Adds `platform text not null default 'web'` to `public.push_subscriptions` and the `(user_id, platform)` index.
- Creates `public.trigger_push_notification()` (identical body to Cloud: reads `push_service_role_key` from `vault.decrypted_secrets` and `net.http_post`s to `https://dzglehiopfgfjmxtejve.supabase.co/functions/v1/send-push-notification`).
- Creates a single `AFTER INSERT` trigger `notifications_push_trigger` on `public.notifications` (no duplicates — Cloud currently has three copies of the same trigger, which we won't repeat).
- Creates `public.seed_push_vault_key(text)` so the key can be seeded from an edge function.

### 2. Seed the service role key into production's vault
Deploy `seed-push-vault-key` targeting the external project (it already exists — we just need to invoke it once against production URL with the external service role key). This unlocks the trigger's `net.http_post` call.

### 3. Deploy `send-push-notification` under the external project as well
The trigger will call `https://dzglehiopfgfjmxtejve.supabase.co/functions/v1/send-push-notification`. If that function isn't deployed on the external project, the POST 404s silently. Confirm it's deployed there; if not, deploy it and set the APNs + VAPID secrets on the external project too.

### 4. Clean up stale web-push subscriptions
Production has ~20 duplicate `web.push.apple.com/…` rows for @sarahhearn2, all from a single PWA session on July 20 01:37–01:38 UTC. Delete rows older than the newest 1 per user so the edge function stops trying to fan out to dead endpoints. (Non-blocking, but reduces noise and 410 cleanup churn.)

### 5. Ship a new TestFlight build so the native APNs token registers
Once step 1 lands, `useNativePushNotifications` will succeed and insert a row with `platform='ios'`. Until then, no APNs token exists on production and even a working trigger has nothing to send to for your native app. After the build installs and you accept the prompt, verify a row appears with `platform='ios'` and endpoint starting with a 64-hex device token (not `https://…`).

### Verification after deploy
- Have @jcsbh post a fresh comment on a @sarahhearn2 listing.
- Confirm `send-push-notification` edge function logs show `Found 1 subscription(s)` and `APNs …` for the iOS sub.
- Confirm the phone receives the banner.
- Repeat for a `mention`, an `order_message`, and a manual `item_sold` to prove app-wide coverage, not just comments.

## Technical section

- Migration goes to external via `psql "$EXTERNAL_SUPABASE_DB_URL"` (Cloud migration tools only touch the Cloud DB, which is why production drifted).
- `trigger_push_notification` body must be byte-identical to the Cloud version (already in `db-functions` context) but with the URL hardcoded to the external project ref.
- `seed_push_vault_key` should upsert into `vault.secrets` (matches existing Cloud implementation).
- `send-push-notification` is unchanged — it already reads `EXTERNAL_SUPABASE_URL`/`EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` and dispatches web-push vs APNs based on `platform`.
- The Cloud DB's three duplicate triggers can be pruned to one at the same time to keep the two DBs consistent, but that's cosmetic — Cloud never sees notification inserts anyway.

## Out of scope for this plan (say the word if you want them folded in)

- Rate-limiting duplicate PWA subscriptions per user (bug that let ~20 identical rows accumulate in one minute).
- Migrating any other schema drift between Cloud and production (only push was checked).

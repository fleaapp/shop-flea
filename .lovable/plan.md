
# Cutover: external Supabase → Lovable Cloud (single DB)

Goal: make Lovable Cloud (`teaicrimlqdayqpmxasc`) the only database, retire the external instance (`dzglehiopfgfjmxtejve`), eliminate schema drift permanently.

**Scope**: 2 users, 13 listings, 4 orders, 6 push subs. Small. Downtime target: <15 min.

---

## Phase 0 — Pre-flight (no user impact)

1. Snapshot both DBs (Cloud export via Cloud → Advanced → Export data; external via `pg_dump` I run against `$EXTERNAL_SUPABASE_DB_URL`). Store both.
2. Confirm auth password-hash export is available on external (Supabase admin API supports it; if not, plan a password reset for the 2 real accounts).
3. Take an inventory of every hardcoded external URL and every `EXTERNAL_SUPABASE_*` env var reference across the ~50 edge functions and 2 src files. Save as a checklist.

## Phase 1 — Get Cloud schema production-ready

The current Cloud schema is already the "good" one (it has all the guards, RPCs, triggers). We just need to make sure the tables that exist only on external get created on Cloud too:

- Create on Cloud: `user_roles` + `has_role`, `banned_users`, `error_logs`, `suggestions`, plus the `handle_new_profile` and `cleanup_removed_listing` functions/triggers.
- Verify with the DB linter and security scan — fix any RLS/GRANT gaps before data lands.

## Phase 2 — Data migration (external → Cloud)

In dependency order, using `pg_dump --data-only` per table + `psql` into Cloud, wrapped in a transaction:

1. `auth.users` (via Supabase admin API `POST /auth/v1/admin/users` with `password_hash` if available, otherwise skip and reset).
2. `profiles`, `user_roles`.
3. `countries`, `regions`, `brands` (reference data — Cloud already has some; upsert by natural key).
4. `listings`, `listing_comments`.
5. `orders`, `order_messages`, `reviews`.
6. `favorites`, `cart_items`, `saved_searches`, `buyer_addresses`.
7. `notifications`, `push_subscriptions` (keep endpoints as-is; browser/APNs don't care which DB stored them).
8. `chat_threads`, `chat_messages`, `payment_events`, `waitlist`, `contact_submissions`, `error_logs`, `suggestions`, `banned_users`.

For each table I disable the notification/side-effect triggers during the copy (so we don't spam users with "item sold" pushes from historical orders), then re-enable.

## Phase 3 — Storage migration

Two buckets: `listings` (public), `order-attachments` (private).

- Recreate both on Cloud with same names/visibility/policies.
- Copy every object with a script: `list → download from external → upload to Cloud → verify checksum`.
- Rewrite any DB rows that store absolute external URLs to Cloud URLs (image URLs on `listings.images`, avatar URLs on `profiles.avatar_url`, attachment URLs on `order_messages` and refund proofs).

## Phase 4 — Code sweep

Mechanical find-and-replace across the repo:

- All ~50 edge functions: replace every `EXTERNAL_SUPABASE_URL`, `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`, `EXTERNAL_SUPABASE_ANON_KEY` reference with the standard `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` (which Cloud injects automatically).
- Remove the raw-REST fallbacks we added specifically to bypass PGRST204 against external — they're no longer needed once the schema and Cloud match.
- `src/lib/supabase.ts` and `src/utils/optimizedImage.ts`: strip any hardcoded external host.
- Deploy the updated edge functions.

## Phase 5 — Third-party endpoint swap

Do these **immediately before** cutting the app over, so old and new endpoints both work for a few minutes:

| Service | What to change |
|---|---|
| Stripe → Webhooks | Add new endpoint `https://teaicrimlqdayqpmxasc.supabase.co/functions/v1/stripe-webhook`. Copy new signing secret into Cloud `STRIPE_WEBHOOK_SECRET`. Keep old endpoint enabled 24h for safety, then delete. |
| Stripe Connect | Return / refresh URLs if any point at the external functions host. |
| PayPal → Webhooks | Same pattern — add new endpoint, rotate `PAYPAL_WEBHOOK_ID`. |
| Google OAuth | Add `https://teaicrimlqdayqpmxasc.supabase.co/auth/v1/callback` to authorized redirect URIs. |
| Apple Sign in | Return URL swap on Services ID. |
| AfterShip | If webhook callbacks exist, swap host. |
| Resend | Reconnect to Cloud auth SMTP (or migrate to Lovable Email on Cloud — recommended). |

## Phase 6 — Cutover

1. Put external into read-only mode (revoke `INSERT`/`UPDATE`/`DELETE` from `authenticated`/`anon`).
2. Run a final delta sync of any rows that changed since Phase 2 (should be near-zero given no live users).
3. Update `.env` via the Lovable Cloud connection so `VITE_SUPABASE_URL` and keys point at Cloud.
4. Publish the app.
5. Trigger a new TestFlight build with the new URL baked in. Upload.
6. Sign in on web + install the new TestFlight build. Verify: home feed, create listing, favorite, checkout end-to-end with a real card, push notification arrives from a test comment.

## Phase 7 — Retire external (delayed)

Wait **7 days** with everything running on Cloud before touching external. During that window:

- External stays alive, read-only, as an instant rollback target.
- Monitor Cloud DB health, error logs, edge-function logs daily.

After 7 clean days:

- Delete `EXTERNAL_SUPABASE_URL`, `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`, `EXTERNAL_SUPABASE_ANON_KEY`, `EXTERNAL_SUPABASE_DB_URL` from Cloud secrets.
- Update `mem://index.md`: remove the "External Supabase is source of truth" rule; add "Lovable Cloud is the only database — never reference `EXTERNAL_SUPABASE_*`, never write raw REST bypasses."
- Pause the external Supabase project (keep the snapshot; don't delete yet).
- After 30 more days, delete the external project.

---

## Rollback plan

If anything breaks in the first 7 days:

1. Revert `.env` to external URL + keys (one commit).
2. Republish + push old TestFlight build back.
3. Re-enable writes on external.
4. Total rollback time: ~5 minutes.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auth password hashes don't export | Medium | Reset the 2 real users' passwords manually. Trivial. |
| Historical push subs fire duplicate notifications | Low | Disable notification triggers during data copy. |
| Stripe webhook briefly hits old URL | Low | Keep both endpoints live 24h. Stripe retries failed webhooks. |
| Missed hardcoded URL somewhere | Medium | Full repo grep in Phase 4; edge-function logs will surface any remaining refs immediately after cutover. |
| Storage object URL rewrite misses rows | Low | Post-migration audit query looks for any remaining `dzglehiopfgfjmxtejve` string in DB. |
| Old TestFlight builds keep talking to external | Certain | Expected. That's why external stays read-only for 7 days. New TestFlight build is mandatory. |

## Timeline

Realistic single-session execution: **3–4 hours end-to-end** for Phases 0–6, most of it in Phase 2 (data + storage copy) and Phase 4 (code sweep + edge function deploy).

## Technical detail

- Schema on Cloud is already the canonical shape (this is what the migration tool has been building against for months). Only additive changes needed in Phase 1.
- Data migration script uses `pg_dump --data-only --disable-triggers -t <table>` piped into `psql` with `session_replication_role = replica` around the load, then re-enabling triggers before commit.
- Storage copy uses the Supabase JS admin client (`listBuckets → list → createSignedUrl → download → upload`). Small enough dataset that a single Node script handles it.
- Edge function sweep is a codemod: `s/EXTERNAL_SUPABASE_URL/SUPABASE_URL/g` and similar for the other two env vars, plus removing the `Deno.env.get("EXTERNAL_SUPABASE_...")` fallback blocks.

---

Want me to start with Phase 0 + Phase 1 (safe, reversible: just snapshots + adding a few tables to Cloud)? That gets us set up without touching anything user-facing, and you can review before we move data.

# Scalability Roadmap — Implement Before Resize

Goal: harden the backend, database, and frontend so the app is ready for thousands of users. Resize picker returns at the end.

---

## Phase 1 — Backend hardening (highest impact)

**1. Neutralise the email-queue firestorm**
- Rewrite `email_queue_wake` so it does NOT (re)schedule cron on every enqueue — only arm cron when queues have >N rows OR after a failed direct dispatch.
- Change `email_queue_dispatch` cron interval from `60 seconds` to `2 minutes` when armed.
- Add an early exit if `email_send_state.retry_after_until > now()`.
- Confirm the historical 876k invocations stop climbing.

**2. Harden SECURITY DEFINER surface**
- `REVOKE EXECUTE ... FROM anon, authenticated` on internal helpers: `delete_email`, `enqueue_email`, `read_email_batch`, `move_to_dlq`, `email_queue_dispatch`, `email_queue_wake`, `seed_push_vault_key`, `get_profiles_public`.
- Keep `EXECUTE` for `service_role` only where needed.
- Set explicit `SET search_path = ''` (or `public`) on any DEFINER function still missing it — audit via `supabase--linter`.

**3. Fix `security_definer_view` finding**
- Confirm `profiles_public` view uses `SECURITY INVOKER = ON` (per memory) and re-run scanner to clear.

---

## Phase 2 — Database performance

**4. Add missing indexes for hot paths** (all created via migration, plain `CREATE INDEX`):
- `notifications (user_id, is_read, created_at DESC)` — badge count query
- `orders (buyer_id, status)` and `orders (seller_id, status)` — nav badges + dashboards
- `order_messages (order_id, read) WHERE read = false` — unread counts
- `cart_items (listing_id)`, `favorites (listing_id)` — sold-notification fanout
- `listings (status, region_id, created_at DESC)` — home feed candidate scan
- `chat_messages (thread_id, read, sender_type)` — support unread

**5. Tighten `get_home_feed`**
- Cap candidate scan to `LIMIT 300` (down from 500) once indexes land.
- Add `STABLE PARALLEL SAFE` where applicable.

**6. Run `supabase--slow_queries` after indexes**
- Verify top offenders drop; add follow-up indexes only for what actually shows up.

---

## Phase 3 — Frontend & realtime

**7. Query hygiene**
- Replace `select('*')` in `useListings.ts` and other hot hooks with explicit column lists (drop heavy fields like `description`, extra image arrays from list views).

**8. Realtime discipline**
- Audit realtime channels: ensure each subscribed table has a filter (`user_id=eq.<uid>`) and channels are cleaned up on unmount. Consolidate duplicate subscriptions.

**9. Bundle & caching**
- Confirm route-level code splitting on the heaviest pages (Admin, Checkout, SellerDashboard).
- Add `staleTime` (30-60s) on nav-badge and profile queries to reduce refetch storms.

---

## Phase 4 — Return to compute resize

**10. Recheck `db_health`** — confirm memory / connection pressure after cleanup.

**11. Open the resize picker** via `supabase--resize_compute` so you can see exact credit costs and pick a size (Small for dev, Large before launch).

---

## Technical notes

- All schema/function/index changes go through the migration tool in small, reviewable batches.
- Cron changes to `email_queue_dispatch` use the insert tool (contains project-specific URL + anon key per project rules).
- After each phase, re-run `security--run_security_scan` and `supabase--linter` to confirm findings decrease, not increase.
- No changes to payment flows, RLS on user tables, or UI behaviour in this roadmap — purely infra + query shape.

Approve to switch to build mode and I'll start with Phase 1.
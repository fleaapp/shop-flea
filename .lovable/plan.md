# Scalability audit before scaling to thousands of users

## Goal
Assess whether the Flea app can reliably serve thousands of concurrent users, identify bottlenecks, and harden the architecture before a high-traffic launch.

## Current signals
- `supabase--db_health` returned `metrics_unavailable: metrics payload exceeded size cap`, which usually means the database is carrying very large metrics/telemetry tables.
- `supabase--slow_queries` surfaced several queries with high call counts or slow mean/max times, including `public.email_send_state` polling, `profiles` updates, `listings` lookups, and `error_logs` reads.
- No pending Project monitoring findings, but the metrics failure itself is a warning sign.

## Proposed audit and fixes

### 1. Database bloat and metrics cleanup
- Investigate which tables are consuming the most disk (focus on `cron.job_run_details`, `error_logs`, realtime/notification tables).
- Confirm the previous `cleanup-cron-logs` edge function is still scheduled and effective.
- Add retention limits and indexes where missing so metrics queries do not scan huge tables.

### 2. Query optimisation
- `public.email_send_state` polling: review whether it can be event-driven instead of hot-polling.
- `profiles` updates (negative balance, Stripe status): batch or debounce where possible; ensure indexes exist on `user_id`.
- `listings` lookups by id array: confirm index usage and avoid unbounded `LIMIT`/`OFFSET`.
- `error_logs` admin reads: add indexes on `created_at`, `source`, `severity` and enforce a max look-back window.

### 3. Edge function and job review
- List all active edge functions and cron jobs.
- Check for redundant or overlapping schedules (e.g., duplicate refund/auto-approve jobs were cleaned up previously; verify none have returned).
- Ensure timeout and memory settings match workload.

### 4. Frontend performance
- Review bundle size, lazy-loading, and image optimisation (WebP/AVIF, bypass Supabase CDN per project memory).
- Check for N+1 reads in hooks like `useOrders`, `useNotifications`, `useHomeFeed`.
- Verify realtime subscriptions are scoped and cleaned up.

### 5. Capacity and cost planning
- After cleanup, re-run `db_health` and `slow_queries` to measure improvement.
- If memory/connection saturation remains, recommend a Lovable Cloud compute resize.
- Estimate per-transaction cost and margin at scale.

## Deliverables
- A short report: current readiness (Yes / No / With caveats), top 3 blockers, and a launch-readiness checklist.
- Code/schema fixes for the blockers.
- Re-run diagnostics to prove improvement.

## Files and areas to inspect
- Edge functions under `supabase/functions/`.
- Database migrations under `supabase/migrations/`.
- React hooks and contexts under `src/hooks/` and `src/context/`.
- Admin/error logging under `src/pages/admin/` and `src/lib/errorLogger.ts`.

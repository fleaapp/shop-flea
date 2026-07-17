## Live Error Logging in Admin Dashboard

Capture client, edge function, payment, and auth errors into a single table, surface them live in the admin dashboard with rich metadata, auto-purge after 30 days.

### 1. Database

New table `public.error_logs`:

- `id` uuid pk
- `created_at` timestamptz default now()
- `source` text — `client` | `edge_function` | `payment` | `auth`
- `severity` text — `error` | `warning` | `critical`
- `user_id` uuid null (references profile via join)
- `username` text null (denormalised for fast display)
- `title` text — one-line human summary ("Refund failed", "Checkout crashed", etc.)
- `message` text — full error message
- `stack` text null — stack trace
- `route` text null — page URL / edge function path
- `device` jsonb null — `{ platform, app_version, user_agent, viewport }`
- `context` jsonb null — `{ order_id, listing_id, payment_intent, function_name, http_status, ... }`

RLS: `authenticated` can `INSERT` their own client errors; only admins (`has_role(auth.uid(), 'admin')`) can `SELECT` / `DELETE`. `service_role` full access for edge functions to insert.

Added to `supabase_realtime` publication so admin feed updates live.

Daily `pg_cron` job to `DELETE FROM error_logs WHERE created_at < now() - interval '30 days'`.

### 2. Ingestion

**Client runtime errors** (`src/lib/errorLogger.ts`):
- Wire into existing React error boundary + `window.onerror` + `unhandledrejection`.
- Sends to new edge function `log-error` with route, stack, device info, user_id.
- Debounced/deduped in-memory (same message within 30s dropped) to prevent spam.

**Edge function failures**:
- Shared helper `supabase/functions/_shared/logError.ts` — every existing function's `catch` block calls `logError({ source: 'edge_function', ... })` with function_name and http_status.
- Wire into the top-level try/catch of the high-risk functions: `stripe-connect-refund`, `finalize-checkout`, `stripe-connect-payout`, `stripe-connect-topup`, `order-messages`, `stripe-connect-status`, `auto-refund-unshipped`, `delete-account`, `admin-data`.

**Payment events**:
- Stripe webhook handler (`stripe-webhook`) logs `payment_intent.payment_failed`, `charge.refund.updated` failures, `payout.failed`, `account.updated` with `requirements.disabled_reason`.

**Auth failures**:
- `src/pages/Auth.tsx` and OAuth callback log signInWithPassword / OAuth errors client-side (bad password excluded — only unexpected errors like network, provider conflict, blocked account).

### 3. `log-error` edge function

- Public (no JWT) — accepts anon client errors, but attaches `user_id` from Authorization header when present.
- Rate-limited via existing `check_and_record_rate_limit` (30 per user/IP per minute).
- Server-side length caps (message 2k, stack 8k, context/device jsonb 4k).
- Inserts into `error_logs` via service role.

### 4. Admin dashboard UI

New tab in existing `AdminDashboard.tsx`: **Errors** (badge count of last-24h unresolved).

Feed layout:
- Filters: Source (All / Client / Edge / Payment / Auth), Severity, Time range (1h / 24h / 7d / 30d), free-text search on title+message.
- Row: severity dot, timestamp (relative), source badge, `@username` (tappable → profile), title, chevron.
- Realtime subscription on `error_logs` INSERT prepends new rows with a subtle highlight flash.
- Tap row → drawer with full detail:
  - Full message, stack (monospace, scrollable)
  - Route, device (platform + version + UA)
  - Context (order_id / listing_id / payment_intent as tappable links opening the relevant admin drawer)
  - "Copy details" button
  - "Delete" button (admin only)

### 5. Files to add / edit

**New**
- `supabase/migrations/<ts>_error_logs.sql`
- `supabase/functions/log-error/index.ts`
- `supabase/functions/_shared/logError.ts`
- `src/lib/errorLogger.ts`
- `src/components/admin/AdminErrorsTab.tsx`
- `src/components/admin/AdminErrorDetailSheet.tsx`
- `src/hooks/admin/useAdminErrors.ts`

**Edit**
- `src/main.tsx` — install `window.onerror` / `unhandledrejection` hooks.
- `src/components/ErrorBoundary.tsx` — call `logError` in `componentDidCatch`.
- `src/pages/AdminDashboard.tsx` — add Errors tab and badge.
- `src/hooks/admin/useAdminBadges.ts` — include 24h error count in admin settings badge.
- High-risk edge functions listed above — wrap catches with `logError`.

### Answer to "anything else?"

Yes — I'd suggest adding these while we're here:
- **Severity levels** so critical Stripe/refund failures stand out from noisy client warnings.
- **Deduplication window** so a broken screen doesn't flood the log with 1000 identical rows.
- **Tappable context links** (order/listing/payment_intent) so an admin can jump straight from an error to the affected order drawer.
- **24h admin badge** on the Errors tab so you notice spikes without opening the dashboard.

Not included unless you want them: email/push alerts to admins on new `critical` errors, and a "Resolved" toggle to hide handled errors from the feed.
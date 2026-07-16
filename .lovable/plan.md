## Goal

Turn the admin dashboard into a clean, Flea-branded, Settings-style page. Add two new sections (Brand management, Refund/dispute management). Fix the outdated user list. Route admin logins directly to the dashboard.

## 1. Admin login flow

- Reuse existing Auth page — no new login screen or extra password.
- On successful sign-in, check `user_roles.has_role(uid, 'admin')`. If admin, redirect to `/admin` instead of `/` (unless a specific `?redirect=` was passed).
- In sarahhearn2's Settings, the existing "Admin dashboard" row already navigates to `/admin`. Keep it; it'll now open the new Settings-style menu directly.
- Non-admins keep landing on `/`. `AdminRoute` still guards `/admin/*`.

## 2. New admin dashboard shell (`/admin`)

Rebuild `src/pages/admin/AdminDashboard.tsx` to look and feel like the user Settings page:

- Flea header (centered title "Admin", back arrow to `/`).
- Vertical scroll of grouped rows. Each row = emoji/icon on the left, label, right-side live count badge (only shows when > 0), chevron. Tap opens the corresponding sub-page or sheet.
- Same card, radius, typography, dividers, spacing as `src/pages/Settings.tsx`.
- Groups:
  - **Marketplace** — Listings management, Brand management (new), Transactions dashboard, Refunds & disputes (new)
  - **People** — User management, Banned users, Sign-ups (waitlist), Contact submissions
  - **Moderation** — Reports, Support chats, User suggestions
  - **System** — Diagnostics
- Sign out row at the bottom (matches Settings).

Retire `src/components/admin/dashboard/DashboardHeader.tsx` in favor of the new shell (or reduce it to a shared top bar for sub-pages).

## 3. Live badges

New hook `src/hooks/admin/useAdminBadges.ts` that returns open counts and subscribes to changes in realtime:

- Reports: `reports` where `status = 'pending'`
- Support chats: `chat_threads` where `status = 'active'` with unread admin messages
- Contact submissions: `contact_submissions` where `notified_at IS NULL`
- Sign-ups: `waitlist` where `notified_at IS NULL`
- Suggestions: unresolved rows
- Refunds & disputes: orders with `refund_requested_at IS NOT NULL AND refunded_at IS NULL`, plus Stripe disputes needing response (fetched via edge function, polled every 60s + on focus)
- Banned users: `profiles` where `status = 'blocked'`
- Diagnostics: unresolved errors count

Each opens a Supabase realtime channel scoped to the table so badges update instantly. Cleaned up on unmount.

## 4. Fix outdated user list

`useAdminUsers` currently only refetches when filters change. Update `src/pages/admin/AdminUsers.tsx` to call `reload()` on every mount (fresh data every visit, as requested).

## 5. New: Brand management

New page `src/pages/admin/AdminBrands.tsx` + hook `src/hooks/admin/useAdminBrands.ts` + `brandAction` handlers in `supabase/functions/admin-data/index.ts`.

Features:
- List all brands from `public.brands` with search, sort by `usage_count`, `created_at`, `display_name`.
- Show usage count, created date, whether user-submitted.
- Actions: rename `display_name`, merge duplicate brand into another (reassigns `listings.brand`, deletes the merged brand), delete unused brand (blocked if usage > 0 unless force), add new brand manually.
- All mutations go through the `admin-data` edge function so RLS/`brands_update_guard` is bypassed with service role, and audit-logged.

Add nav row on the new dashboard.

## 6. New: Refund / dispute console

New page `src/pages/admin/AdminRefunds.tsx` + hook `src/hooks/admin/useAdminRefunds.ts`.

Two tabs:
- **Refund requests** — orders where `refund_requested_at IS NOT NULL`, filtered by state (pending, approved, denied, completed). Row shows buyer, seller, item, amount, reason, requested date. Detail sheet exposes: approve & refund (calls existing `stripe-connect-refund`), deny with note, view chat, view order.
- **Disputes** — pulled live from Stripe via new edge function `supabase/functions/admin-list-disputes/index.ts` (uses `stripe.disputes.list`, joins to our `orders` by `payment_intent_id`). Filter: needs response, warning_needs_response, under_review, won, lost. Detail sheet: view evidence deadline, view order, attach evidence (upload files, submit via `stripe.disputes.update` — new edge function `admin-submit-dispute-evidence`), accept dispute.

Add nav row on the new dashboard.

## 7. Existing sections — keep and reskin

Preserve current functionality of Listings, Transactions, Users, Reports, Support chats, Suggestions, Contact submissions, Waitlist, Banned users, Diagnostics — just move them behind the new Settings-style menu and give each sub-page the same Flea header (back arrow + centered title, matches Settings sub-pages). No feature regressions.

## 8. Landing project

Confirmed: Flea Landing writes waitlist + contact submissions to the same Supabase project. The existing admin hooks already read them, so no cross-project plumbing needed.

## Files to add

- `src/pages/admin/AdminBrands.tsx`
- `src/pages/admin/AdminRefunds.tsx`
- `src/hooks/admin/useAdminBadges.ts`
- `src/hooks/admin/useAdminBrands.ts`
- `src/hooks/admin/useAdminRefunds.ts`
- `supabase/functions/admin-list-disputes/index.ts`
- `supabase/functions/admin-submit-dispute-evidence/index.ts`

## Files to edit

- `src/pages/admin/AdminDashboard.tsx` — full rewrite to Settings-style menu
- `src/pages/admin/AdminUsers.tsx` — refetch on mount
- `src/App.tsx` — add `/admin/brands` and `/admin/refunds` routes
- `src/pages/Auth.tsx` (or auth redirect helper) — redirect admins to `/admin`
- `supabase/functions/admin-data/index.ts` — add `listBrands`, `brandAction`, `listRefundRequests`, refund approve/deny actions
- Sub-page headers (AdminUsers, AdminListings, AdminTransactions, AdminErrors) — swap in the shared Flea sub-page header

## Out of scope

- No changes to user-facing app or Stripe onboarding.
- No new admin auth mechanism (role-gated only, as chosen).
- No historical audit log UI (can be a follow-up if wanted).

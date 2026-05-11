# Admin section inside Flea (port of Support Hub + extras)

## What you'll get

A new `/admin` area inside the Flea app, accessible only to users with the `admin` role. It contains everything the standalone Support Hub has today — plus a few sensible additions — and reads/writes against your **external Supabase** (the same DB the Flea app uses), so the data is live, not mirrored.

## Sections

```text
/admin                    → redirects to /admin/support
  /admin/support          → live support chat (chat_threads + chat_messages)
  /admin/reports          → user/listing/comment reports queue
  /admin/bans             → banned/blocked users, lift/restore
  /admin/suggestions      → user feedback inbox
  /admin/transactions     → all orders, filters, CSV export
  /admin/users            → NEW: search any user, view profile + strikes + actions
  /admin/listings         → NEW: search/remove any listing, view reports
  /admin/overview         → NEW: KPI dashboard (GMV, active sellers, open reports, etc.)
```

## Access control

A new `user_roles` table with an `admin` enum value, plus a `has_role(uid, role)` security-definer function. The `/admin/*` routes are gated client-side **and** every admin write goes through edge functions that re-check the role server-side (never trust the client). Non-admins hitting `/admin` get redirected.

You'll grant yourself the admin role with one SQL line after the table is created — I'll give it to you.

## Recommended additions (the "plus" you asked for)

1. **Overview/KPI dashboard** — at-a-glance: GMV last 7/30 days, new signups, active listings, open reports, pending shipments overdue.
2. **User search & 360° view** — search by username/email, see their listings, orders, reports filed against them, strikes, ban history. One-click ban / lift ban / send support message.
3. **Listing search & moderate** — search any listing, remove it, see who reported it.
4. **Audit log** — every admin action (ban, lift, remove listing, status change) writes a row to `admin_actions` so there's a paper trail.
5. **In-app admin badge** — small "Admin" pill in your bottom nav so you can jump to `/admin` from anywhere.

## Tech approach

- **Routes:** new `src/pages/admin/*` files + an `<AdminLayout>` with sidebar nav (desktop) / tab bar (mobile). Lazy-loaded so it doesn't bloat the main bundle.
- **Auth gate:** `<AdminRoute>` wrapper that checks `has_role(auth.uid(), 'admin')` and redirects otherwise.
- **Data:** ports the 9 hooks from the Hub almost verbatim (they already use `supabase` client, which in this project points at the same external Supabase the Hub uses).
- **Edge functions:** small `admin-action` function that validates the caller is an admin and performs privileged writes (ban user, lift ban, remove listing, mark report resolved). Keeps RLS strict.
- **Audit:** triggers on `admin_actions` table for an immutable log.

## Database changes needed (in your **external** Supabase)

Because my migration tool only writes to Lovable Cloud, I'll give you the SQL to paste once. It creates:

- `app_role` enum (`admin`, `moderator`, `user`)
- `user_roles` table with RLS
- `has_role()` security-definer function
- `support_suggestions` table (if not present) for the Suggestions tab
- `user_bans` table for ban records (active, lifted, reason, lifted_by, lifted_at)
- `admin_actions` audit table
- Adds a `status` value `'banned'` distinct from `'blocked'` if you want it (optional)

I'll inspect the external DB first to see which of these already exist (suggestions and bans may need to be created — the Hub project has hooks for them).

## Out of scope (call out if you want them)

- Email templates / branded notifications to banned users
- Multi-admin permissions tiers (just `admin` for now)
- Mobile push to admins on new reports

## Build order

1. Inspect external DB → confirm which tables exist, give you a single SQL block to run.
2. After you run it, scaffold `<AdminLayout>`, `<AdminRoute>`, role hook.
3. Port Support tab (most complex — chat).
4. Port Reports + Bans + Suggestions + Transactions.
5. Build new Overview, User search, Listing search, audit log.
6. Add admin pill to nav, wire `/admin` redirect.

Estimated 4–6 build cycles. I'll do it in stages and check in between each so you can sanity-check before I push further.

---

**Approve this plan to start, or tell me what to change.** Likely tweaks: drop the "extras" if you want a pure 1:1 port, or add specific KPIs to the Overview.

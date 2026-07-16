## Admin dashboard polish — fixes

### 1. Refunded listing missing from Listings management
- `supabase/functions/admin-data/index.ts` `listListings`: the "refunded" filter passes `status=eq.refunded`, but refunded listings live under mixed statuses (some `refunded`, some still `sold` with `refunded_at` set on the order, some `active` if never re-flagged). Fix by:
  - When `status === 'refunded'`, fetch orders where `refunded_at IS NOT NULL`, collect `listing_id`s, then return listings whose id is in that set OR whose status is `refunded`.
  - Guarantees restored refunded listings appear even if their listing status wasn't updated.

### 2. Double `@` on User management
- `src/pages/admin/AdminUsers.tsx` renders `@{u.username}` and profile `username` values already include `@`. Remove the extra `@` in the list row (line 118) and in `DialogTitle` (line 148) — use `{u.username}` directly (usernames are stored with the `@` prefix per existing memory).
- Apply same fix anywhere else in admin surfaces that prefixes `@` on top of stored usernames (spot-check AdminListings seller line, AdminRefunds, AdminTransactions rows).

### 3. Refunds $ missing from Transactions summary
- `TransactionSummaryBar` uses `summary.refundTotal`. `useAdminTransactions` computes it from `orders` returned by `listTransactions`. Check that `listTransactions` in `admin-data` selects `refunded_at` (and includes refunded orders — not filtered out). Update the SELECT to include `refunded_at` and don't exclude refunded rows so the summary sums correctly.

### 4. Un-updated admin sub-modules (branding + UI parity)
Refactor the following to use `AdminHeader`, `AdminBadge`, `AdminChipFilter`, `AdminEmptyState`, rounded-2xl cards, mobile-first spacing (consistent with Users/Listings/Refunds/etc.):
- `src/pages/admin/AdminDashboard.tsx` sections that route into:
  - Support messages → `src/components/admin/dashboard/ThreadList.tsx` + `ConversationView.tsx` + `MessageBubble.tsx` + `MessageInput.tsx`
  - Reports → `ReportList.tsx` + `ReportDetail.tsx`
  - Banned users → `BannedUsersList.tsx`
  - Suggestions → `SuggestionsList.tsx`
  - Sign-ups / Waitlist → `WaitlistList.tsx`
  - Contact submissions → `ContactSubmissionsList.tsx`

Each gets:
- `AdminHeader` with title + emoji (💬 Support, 🚩 Reports, 🚫 Banned, 💡 Suggestions, 📝 Sign-ups, 📮 Contact).
- Search/filter chips via `AdminChipFilter` where applicable (unread/read, open/resolved, etc.).
- Card list rows (rounded-2xl, `card-shadow`, avatars where relevant, semantic `AdminBadge` tones).
- `AdminEmptyState` with topical emoji + copy.
- Safe-area padding (`pb-24`), `min-h-[100svh]`.

### 5. Detail popups UI update
- `AdminListings.tsx` Dialog and `AdminUsers.tsx` Dialog still use raw `Badge`, plain grid stats, `border` fields. Reskin to match Flea branding:
  - Rounded-2xl `DialogContent` with lime accents.
  - Replace inline `Badge` with `AdminBadge` tones.
  - Stat cards → soft muted rounded-xl tiles, larger numbers, monochrome icons.
  - Action row → grouped, full-width on mobile, destructive isolated at bottom.
  - Remove extra `@` (see item 2).

### Out of scope
- Admin menu (per prior instruction — no changes).
- Business logic beyond the `listListings` refunded fix and `listTransactions` refund inclusion fix.

Once approved I'll implement all six items in one build pass and verify with `tsgo`.

# Admin Sub-Pages – Full Overhaul (Flea-branded, mobile-first)

Goal: bring every admin sub-page in line with Flea's visual language (lime + charcoal, Inter, rounded-2xl cards, emoji accents, semantic badges, soft shadows, sonner toasts) and make everything genuinely mobile-friendly. Leave the `/admin` menu itself untouched.

## Out of scope
- `src/pages/admin/AdminDashboard.tsx` (the menu) — no changes.
- Nav pattern (cards → back) unchanged.
- No data, hook, route, or edge-function changes.

## 1. Shared foundation (new)

Create `src/components/admin/shell/` primitives reused by every sub-page:

- `AdminHeader` — sticky, safe-area-aware, back arrow left, centered emoji + title, optional right slot.
- `AdminSectionScroller` — main scroll container with `pb-[calc(env(safe-area-inset-bottom)+96px)]`.
- `AdminStickyToolbar` — sticky search + filter row with blur backdrop.
- `AdminChipFilter` — horizontally scrollable chip toggles replacing the desktop `Select` dropdowns.
- `AdminStatChip` — rounded-full chips with emoji + count for header stat rows.
- `AdminListCard` — canonical row: rounded-2xl `bg-card card-shadow`, 44px avatar/thumb, title + muted subtitle, right badge stack, chevron, ≥48px tap target, `active:scale-[0.99]`.
- `AdminBadge` — variants `success` (lime) / `warning` (amber) / `danger` (red) / `neutral` / `info`, semantic tokens only. Replaces ad-hoc `emerald-*` / `yellow-*` classes.
- `AdminEmptyState` — emoji + copy + optional action.
- `AdminSkeletonList` — consistent skeleton rows.
- `AdminActionSheet` — bottom-sheet wrapper (Drawer) for row actions on mobile.

All primitives read semantic tokens only — no hardcoded colours.

## 2. Per-page changes

### AdminUsers
- Replace inline icon-tile header with `AdminHeader`. Stats (Total · Active · Suspended · Blocked · Risky) move to a horizontally scrollable `AdminStatChip` row.
- Toolbar: full-width search; status + sort become chip toggles; Asc/Desc = icon button.
- Rows → `AdminListCard`; risk shown as right-side `AdminBadge`.
- Detail dialog → bottom sheet on mobile (Drawer via `useIsMobile`). Stats grid 2-col mobile / 4-col desktop. Actions become a 2-col grid, Delete separated at bottom.
- Tabs restyled as pill scroller.

### AdminListings
- `AdminHeader` + chip filters (All · Active · Refunded · Deleted · Reported).
- Cards: 4:5 thumbnail 48×60, title, `@seller`, price, right-side status `AdminBadge` (Refunded=amber, Deleted=neutral, Active=lime).
- Row tap opens `AdminActionSheet` (view / relist / delete) instead of inline confirms.

### AdminRefunds
- `AdminHeader` + chip filters (All · Pending · Refunded · Disputed).
- Rows: buyer avatar, "@buyer → @seller", listing title truncated, amount + reason badge, timestamp.
- Detail sheet consolidates order + listing snapshot (works even when listing is `refunded`/`removed`).

### AdminTransactions
- `AdminHeader` + chip filters (Succeeded · Pending · Failed · Refunded).
- Sticky stat chips (Gross · Net · Fees · Refunded).
- Rows: amount prominent, `@buyer → @seller`, method emoji (💳/🍎/🅶), timestamp.

### AdminBrands
- `AdminHeader` + search chip. List uses `AdminListCard` with brand emoji fallback tile.
- Add-brand input becomes a sticky bottom composer (matches Flea's comment composer style).
- Small lime dot on newly added brands (per existing memory).

### AdminErrors
- `AdminHeader` + severity chip filters (All · Fatal · Error · Warn).
- Rows: severity emoji (🛑/⚠️/ℹ️), truncated message, route + timestamp, count badge. Tap → sheet with full stack.

### Moderation sub-views (rendered by `AdminDashboard`'s `SectionView`)
Sub-components under `src/components/admin/dashboard/` — the menu itself stays untouched, but the panels shown after tapping into a section are updated:
- `ThreadList`, `ConversationView`, `ReportList`, `ReportDetail`, `BannedUsersList`, `SuggestionsList`, `WaitlistList`, `ContactSubmissionsList` all consume the new shell primitives (chip filters, `AdminListCard`, `AdminEmptyState`, `AdminSkeletonList`).
- The `SectionView` header inside `AdminDashboard.tsx` uses `AdminHeader` — this is a header swap only, no menu changes.

## 3. Mobile fixes applied everywhere
- Replace `h-screen` with `min-h-[100svh]`; honour `env(safe-area-inset-top/bottom)`.
- Any row-detail Dialog → Drawer on mobile via `useIsMobile`.
- All Selects in toolbars → horizontally scrollable chip groups (`overflow-x-auto no-scrollbar`).
- Tap targets ≥ 44px, `gap-2` minimum.
- Pull-to-refresh on list pages whose hooks expose `refresh()` (Waitlist, Contact, Refunds).
- Audit that every admin action fires a sonner toast with a trailing full stop (suspend / ban / reset / delete / refund).

## 4. Branding audit
- Remove every `emerald-*` / `yellow-*` / `red-*` literal in admin files; replace with `AdminBadge` variants bound to tokens.
- Consistent emoji vocabulary (💬 🚩 ⛔️ ↩️ 📦 🏷️ 💳 👥 📮 📬 📥 🛡️).
- Card style: `rounded-2xl bg-card card-shadow` everywhere.

## Technical notes

- **New files** under `src/components/admin/shell/`: `AdminHeader.tsx`, `AdminSectionScroller.tsx`, `AdminStickyToolbar.tsx`, `AdminChipFilter.tsx`, `AdminStatChip.tsx`, `AdminListCard.tsx`, `AdminBadge.tsx`, `AdminEmptyState.tsx`, `AdminSkeletonList.tsx`, `AdminActionSheet.tsx`.
- **Edited pages**: `AdminUsers.tsx`, `AdminListings.tsx`, `AdminRefunds.tsx`, `AdminTransactions.tsx`, `AdminBrands.tsx`, `AdminErrors.tsx`. `AdminDashboard.tsx` menu block untouched — only the `SectionView` header may adopt `AdminHeader` (visual parity), no menu logic changes.
- **Edited sub-components**: files under `src/components/admin/dashboard/*` to consume shell primitives.
- Verify by loading each sub-page and detail sheet at 375px width.

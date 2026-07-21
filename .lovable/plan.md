## Scope

Two related follow-ups from the earlier sweep:
1. Convert the remaining page-level-scroll pages to the internal scroll-shell pattern (fixes lingering "too high" / "won't scroll" cases and prevents iOS rubber-band from revealing the lime footer).
2. Clear the **Error Logs** and **Support chat** badges when the user actually reads them.

No visual redesign — only container structure and badge bookkeeping.

## Part 1 — Scroll-shell sweep

Pattern (already in use on Index/Cart/Favorites/Settings/etc.):
```text
<div className="native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
  <Header … />                                  ← shrink-0
  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24">
    …page content…
  </div>
  <BottomNav /> (if applicable)
</div>
```

Pages to convert (currently `min-h-screen` / `min-h-svh` page-level scroll):

- `src/pages/SellerDashboard.tsx` (root at L277)
- `src/pages/CreateListing.tsx` (main render L607; keep the small "gated" states as-is)
- `src/pages/EditListing.tsx` (L462)
- `src/pages/EditProfile.tsx` (L280)
- `src/pages/Checkout.tsx` (main L598; keep centered gated state)
- `src/pages/CheckoutSuccess.tsx` (both L157 / L168 — centered, wrap in `fixed inset-0` shell)
- `src/pages/Sales.tsx` (L118)
- `src/pages/ListingDetails.tsx` (L493 main render)
- `src/pages/FAQ.tsx` (L10)
- `src/pages/SuggestionBox.tsx` — already shell; verify no double-scroll
- `src/pages/admin/AdminErrorLogs.tsx` (L69)
- `src/pages/admin/AdminUsers.tsx` (L60)
- `src/pages/admin/AdminListings.tsx` (L41)
- `src/pages/admin/AdminRefunds.tsx` (L33)
- `src/pages/admin/AdminTransactions.tsx` (L47)
- `src/pages/admin/AdminBrands.tsx` (L43)
- `src/pages/admin/AdminErrors.tsx` (L28)

Chat pages (`OrderChat`, `ChatConversation`) already use `h-screen` + inner scroll — swap to `h-[100svh]` for iOS URL-bar stability, no other changes.

Rule preserved across all conversions: keep `native-safe-top` on the outer element so `env(safe-area-inset-top)` padding is applied by the shell, not lost when nested content overflows.

## Part 2 — Badge clearing

### Error Logs

- Extend `src/lib/adminLastSeen.ts` `AdminTab` union with `'error_logs'` and add key `admin_error_logs_last_seen`.
- In `src/hooks/admin/useAdminBadges.ts`, filter `errorLogs` count by `getAdminLastSeen('error_logs')` (mirrors how other tabs work: only count rows with `created_at > lastSeen`).
- In `src/pages/admin/AdminErrorLogs.tsx`, call `markAdminTabSeen('error_logs')` in a `useEffect` on mount and whenever the fetched list updates (so newly-arrived rows after the user is already on the page also clear).

### Support chat

- `useUnreadSupport` already recomputes on `['unread-support']` invalidation.
- In `src/pages/ChatConversation.tsx`, when the route is the support thread, mark all inbound messages read on mount and on new-message arrival (update `read_at` for messages where `sender_id != user.id`), then invalidate `['unread-support']` and `['nav-badges']`.
- `useNavBadges` already reads `unread_support` from the RPC, so once messages are flagged read the footer + Settings badge drop to zero without a manual event.

## Validation

- After edits, spot-check three pages on the preview (`SellerDashboard`, `AdminErrorLogs`, `ChatConversation` support thread) via Playwright screenshots: header sits under the notch, body scrolls internally, footer nav stays pinned, no lime bleed on overscroll.
- Confirm Error Logs badge clears immediately on opening `/admin/error-logs` and reappears only when a new row lands.
- Confirm Support badge clears on opening a support conversation.

## Out of scope

- No layout/visual redesign, no header restyling, no auth chrome changes (already fixed).
- No changes to admin RPCs beyond the client-side `lastSeen` filter for `error_logs`.

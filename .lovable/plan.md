# Full-app scroll audit

Goal: check every page and screen in the app — not just the ones I converted this session — and fix any scroll regression or inconsistency. Terms, Privacy, Help Centre articles, onboarding, marketing, everything.

## Why a full sweep is needed

I converted ~15 pages to a `fixed inset-0` scroll-shell this session. That change interacts with things that live *outside* those pages: BottomNav padding, safe-area handling on `#root`, keyboard behavior, sticky sub-headers, scroll-restoration, `scrollIntoView`, pull-to-refresh. So a page I never touched can still be broken by the shared chrome changes — and pages I did touch can have subtle regressions in loading/empty states, keyboard flow, or sticky bars.

Every page needs to be looked at, not just the ones on my edit log.

## Inventory (everything under `src/pages/` + any screen-level component)

I'll enumerate from `src/pages/**` and `src/App.tsx` routes to make sure nothing is missed. Expected set:

- **Auth / onboarding**: Auth, SignUp, Onboarding, SplashScreen, ProfileSetup, PushPermission
- **Core tabs**: Home (swipe stack), Search, Sell/CreateListing, Alerts, Profile
- **Listings**: ListingDetails, EditListing, Wishlist, Cart, Checkout, CheckoutSuccess
- **Orders/Chat**: Sales, Orders, OrderChat, ChatConversation, RefundRequest, ShippingStatus
- **Seller**: SellerDashboard, SellerProfile, SellerOnboardingSheet flows, SettleBalance, IdVerification
- **Settings / Help**: Settings, EditProfile, Notifications, PaymentMethods, Addresses, HelpCentre index, FAQ, Terms, Privacy, Refund Policy, Community Guidelines, Contact/Support, About
- **Admin**: AdminDashboard, AdminUsers, AdminListings, AdminRefunds, AdminBrands, AdminTransactions, AdminErrors, AdminErrorLogs, AdminReports
- **Misc**: NotFound, any marketing/landing pages

I'll build the actual list from the filesystem so nothing is skipped.

## What I check on every page

For each page (converted or not):

- Header/back button visible under the notch (safe-area padding applied and not doubled).
- Page scrolls when content is longer than the viewport.
- Page does **not** scroll when it shouldn't (fixed shells, chat).
- Last row/CTA reachable — not hidden behind BottomNav or home indicator.
- Sticky sub-headers / tab bars / filter chips still stick.
- Keyboard-input pages: input bar stays above the keyboard; active field scrolls into view; submit remains reachable.
- Auto-scroll behaviors (chat scroll-to-bottom, `scrollIntoView`, restore-on-back) target the correct scroll container.
- Loading, empty, error branches use the same layout shell as the loaded state (no jump between `min-h-screen` and `fixed inset-0`).
- No `overscroll-contain` on pages that legitimately need pull-to-refresh (if any).
- `native-safe-top` appears exactly once per page tree.
- No lime bleed at footer, no chrome tint stuck from a prior route.
- Drawers/Sheets/Dialogs opened from the page don't break page scroll on close.

## Method

1. **Enumerate** — list every file under `src/pages/**` and every route in `src/App.tsx` so the checklist is exhaustive.
2. **Static read pass** — for each page, read the file once and mark it against the checklist above. Group into: OK / needs-fix / needs-manual-verify.
3. **Runtime pass on ambiguous cases** — drive Playwright against the running preview at mobile viewport for the pages I can't decide from source alone (sticky headers, keyboard flow, chat auto-scroll, sales tabs, checkout success, help/legal article length). Take screenshots as evidence.
4. **Fix** — apply targeted fixes only where I can point to the exact symptom and cause in code. No speculative rewrites.
5. **Report** — for every page checked, one line in chat: page → status (OK / fixed: X / flagged for you: Y). You get a full matrix, not a summary.

## Known suspects to verify first

- Terms, Privacy, Help Centre articles — long-form content; if they were converted or if they inherit any shell wrapper, confirm the whole document is reachable.
- Home swipe stack — must **not** scroll; confirm it's still fixed and gestures aren't stolen by an inner scroller.
- OrderChat / ChatConversation — composer above keyboard, auto-scroll to newest message.
- Sales — sticky tabs, list reaches bottom above BottomNav.
- SellerDashboard — payout history reaches bottom.
- CreateListing / EditListing — long forms, submit reachable with keyboard open.
- Checkout / CheckoutSuccess — Apple Pay sheet interaction, success state layout consistent with processing state.
- Onboarding / Splash — full-viewport screens, no accidental scroll or safe-area double-padding.
- Admin tables — vertical scroll to last row, horizontal overflow where applicable.

## Fix categories I expect

- Restore missing `pb-24` / `pb-28` on inner scrollers where BottomNav shows.
- Move composer/action bars out of `flex-1` into their own `shrink-0` row.
- Rewrite loading/empty branches to match loaded-state shell.
- Retarget `scrollIntoView` / auto-scroll hooks at the inner scroller ref instead of `window`.
- Remove duplicate `native-safe-top`.
- Re-add sticky positioning on filter/tab bars where lost.
- Convert any page still on `min-h-screen` that regressed after the chrome changes to the standard shell, only if it actually broke.

## Deliverable

One sweep, full matrix report back to you, targeted fixes only. Non-app-owned copy (Terms, Privacy) is layout-only — I don't rewrite legal text, I just make sure the page renders and scrolls end-to-end.
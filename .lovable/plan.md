# Flea — Full Product Audit

Verified this pass by reading the fee engine, Terms, FAQ, refund dialog and scanning the whole `src` tree. Anything I could not confirm is marked "needs check", not asserted.

**Overall Product Health Score: 88/100** — money, refunds and legal copy now line up; the remaining gaps are accessibility, polish and a few consistency issues.

## What I confirmed is correct

- Buyer fee 4% + $0.70 and seller fee 2% + $0.50 come from one file (`feeCalculator.ts`) and match Terms word for word.
- Refund story matches everywhere: 48 hours after delivery to raise an issue, 72 hours for the seller to respond, auto-refund if they don't, Flea review if declined. Same wording in Terms and FAQ.
- Shipping rules match: dispatch in 3 days, reminders at 3/6/8 days, overdue flag at 4 days, auto-refund at 9 days.
- Payouts: first payout up to 7 days, then ~24 hours, instant payout 1.5% — consistent in Terms and FAQ.
- Account deletion rules (no active orders, 14-day cooldown) are stated in both Terms and FAQ.
- Multi-item refunds split shipping and fees pro-rata, and use the fees actually charged, so a FREEFLEA order can't refund a fee that was never taken.

---

## Critical (fix before release)

**C1 — Icon-only buttons have no names for screen readers**
Severity Critical (accessibility) · Screens: Header, Cart, Profile, Seller Profile, Wishlist cards, Create/Edit Listing, Comments, Swipe actions, all Admin screens · Impact: a VoiceOver user hears "button" with no idea what it does; this is also an App Store accessibility risk. Found 38 icon-only buttons and only 2 with labels.
Fix: add a short `aria-label` to every icon-only button ("Close", "Remove from cart", "Delete photo", "Back", etc.).
Complexity: Medium.

**C2 — Images missing alt text on some cards**
Severity Critical (accessibility) · Screens: listing cards, order thumbnails · Impact: unnamed images for screen readers. Roughly 75 `<img>` tags vs 82 `alt` attributes across the app, so coverage is close but needs a sweep to confirm none are missed and that decorative images use `alt=""`.
Fix: audit each `<img>`, give listing photos a real description (title + brand), decorative ones an empty alt.
Complexity: Small.

---

## High priority

**H1 — `h-screen` still used in 23 places**
Screens: various full-height pages/sheets · Impact: on iPhone the browser chrome makes `100vh` taller than the visible area, so footers and buttons get cut off — the exact bug class we've fixed repeatedly. Project rule is `svh`/`dvh`.
Fix: replace `h-screen` with `h-dvh` (or the existing app-shell pattern) everywhere outside `components/ui`.
Complexity: Small.

**H2 — "Item never arrived" refunds have no stated waiting period**
Screens: Refund request dialog, Terms, FAQ · Impact: a buyer can claim non-delivery the moment an order is marked delivered, and the seller has no protection window in the written policy. Terms only mentions "never arrived" as a reason, with no lost-parcel timing.
Fix: state the lost-parcel rule in one place (dialog + Terms + FAQ) and make the dialog show the same wait time it actually enforces.
Complexity: Small.

**H3 — Double-tap protection on money actions**
Screens: Checkout, Create Listing · Impact: only two `disabled` guards on each screen; a slow network plus an impatient tap can create a duplicate charge or duplicate listing. Needs a per-button check that every submit is locked while the request is in flight.
Fix: single "submitting" flag per screen that disables the primary button and shows a spinner until the request settles.
Complexity: Small.

**H4 — Empty and error states pass**
Screens: Wishlist, Cart, Sales, Orders, Search results, Notifications · Impact: empty screens that just show nothing read as "broken app" and kill first-session trust.
Fix: one shared empty-state component — emoji, one line of copy, one action button — used everywhere.
Complexity: Medium.

---

## Medium priority

- **Offline handling.** No global "you're offline" state was found. A network drop mid-checkout should show a clear retry, not a silent failure. Complexity: Medium.
- **Deleted / sold-out item in cart.** Confirm checkout blocks with a friendly message naming the item, instead of a generic error. Needs check. Complexity: Small.
- **Session expiry.** We sign users out on a bad token — confirm they land on the login screen with "Please sign in again", not a blank page. Complexity: Small.
- **Search with zero results.** Should suggest clearing filters, not just show nothing. Complexity: Small.
- **Consistency sweep.** Confirm identical buttons behave identically (Sales button on Profile vs Seller Dashboard, back behaviour on deep links, confirmation dialog sizing). Complexity: Medium.

## Nice to have

- Seller earnings preview shown live while creating a listing ("You'll receive $X").
- Saved-search alerts surfaced more visibly (Depop/Vinted parity).
- Buyer protection badge on the checkout screen — the single biggest trust lever on a new marketplace.
- Order status timeline visible from the notification, not only the drawer.

## Benchmark notes

- **Ahead of Depop/Vinted:** in-app-only seller onboarding with no browser hand-off, live-camera-only refund proof, bundle shipping discounts.
- **Equal:** fee transparency, buyer protection window, tracking-gated payouts.
- **Behind:** accessibility labelling, empty-state polish, offline resilience, and there are no offers/negotiation and no seller analytics.

## Suggested order of work

1. C1 + C2 accessibility labels (release blocker)
2. H1 `h-dvh` sweep
3. H3 duplicate-tap guards
4. H2 lost-parcel copy alignment
5. H4 shared empty states
6. Medium items

## Technical detail

- Fees stay in `src/utils/feeCalculator.ts` — no hardcoded percentages anywhere else.
- Accessibility fixes are presentation-only: `aria-label` on `Button size="icon"`, `alt` on `<img>`. No logic changes.
- `h-screen` → `h-dvh` outside `src/components/ui`.
- Empty states as one component in `src/components/` reused across list screens.

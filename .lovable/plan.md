# Flea — Full Product Audit (this pass)

I re-checked the app against the last audit rather than repeating it. The previous critical items are genuinely done: accessibility labels are on the icon buttons, `h-screen` is gone from every page (only `index.css`, `main.tsx` and `Auth.tsx` keep it deliberately for the app shell), the shared `EmptyState` is used across Wishlist, Cart, Sales, Notifications and every admin list, and fees/refund/shipping copy still line up between the fee engine, Terms and the FAQ.

**Overall Product Health Score: 91/100** — money, legal copy and accessibility are solid. What's left is resilience and polish.

---

## Critical (fix before release)

**C1 — No offline handling anywhere**
Severity Critical · Screens: whole app, worst at Checkout · User impact: a dropped connection mid-payment shows a generic failure with no way to know whether the money went through. Business impact: abandoned purchases and support tickets. I searched the whole `src` tree and found no `navigator.onLine` check, no offline banner, no retry surface.
Fix: a small global "You're offline" bar plus an offline-aware error on the Pay button that says "We couldn't reach the network — your card was not charged. Try again."
Complexity: Medium.

**C2 — Pay button has no in-flight re-entry guard**
Severity Critical · Screen: Checkout · User impact: `handlePayClick` has no `if (submitting) return;` at the top — the same guard Create Listing already got. On a slow network an impatient double tap can start two payment attempts. Business impact: duplicate charge risk and refund work.
Fix: one submitting flag checked at the top of `handlePayClick`, released in a `finally`.
Complexity: Small.

---

## High priority

**H1 — Sold or removed item silently disappears at checkout**
Screens: Cart, Checkout · Checkout filters out paused, inactive, removed and sold items from the payable list, but nothing tells the buyer. An item vanishes from the total with no message. Fix: show a named line — "Vintage Levi's jacket sold while it was in your cart and has been removed." Complexity: Small.

**H2 — Search with zero results has no guidance**
Screens: Search, filtered Home · No "no results" copy found in the search surfaces. A blank screen after applying filters reads as broken. Fix: reuse `EmptyState` with a "Clear filters" action. Complexity: Small.

**H3 — Session expiry landing**
Screens: any protected route · We sign users out on a bad token; confirm they land on the login screen with "Please sign in again" rather than a blank frame. Fix: pass a reason flag into the auth redirect and show it. Complexity: Small.

## Medium priority

- **Seller earnings preview while listing.** Show "You'll receive $X" live on Create Listing using the existing fee engine. Reduces the biggest seller drop-off. Complexity: Small.
- **Buyer protection badge at checkout.** One line above Pay restating the 48-hour window. The single biggest trust lever on a new marketplace. Complexity: Small.
- **Consistency sweep.** Confirm identical buttons behave identically — Sales on Profile vs Seller Dashboard, back behaviour on deep links, confirmation dialog sizing. Complexity: Medium.
- **Order status timeline from the notification**, not only inside the drawer. Complexity: Small.

## Nice to have

- Saved-search alerts surfaced more visibly.
- Offers / negotiation — expected on Depop and Vinted, absent here.
- Seller analytics (views, saves per listing).

## Benchmark

- **Ahead:** in-app-only seller onboarding with no browser hand-off, live-camera-only refund proof, bundle shipping discounts.
- **Equal:** fee transparency, buyer protection window, tracking-gated payouts, empty-state polish, accessibility labelling.
- **Behind:** offline resilience, no offers, no seller analytics.

## Suggested order of work

1. C2 pay guard (one line, removes duplicate-charge risk)
2. C1 offline state
3. H1 removed-item message, H2 zero-results, H3 session expiry
4. Earnings preview and protection badge
5. Consistency sweep

## Technical detail

- Guard goes at the top of `handlePayClick` in `src/pages/Checkout.tsx`; the filter at line 143 is where the dropped-item names come from for H1.
- Offline state as one hook plus a bar rendered in the app shell; Checkout reads the same hook.
- Zero-results and session-expiry reuse `src/components/EmptyState.tsx` — no new patterns.
- Earnings preview reads `src/utils/feeCalculator.ts`; no new fee maths anywhere.

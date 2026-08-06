# Flea - Full Product Audit Report

Four parallel specialist passes: Payments/Security, Marketplace/Offers/Orders/Shipping, UX/UI/A11y/Performance, Copy/Legal/Notifications.

## Critical
1. Terms/Privacy back button hardcodes `/settings`. Guests who open them from signup get bounced into a protected route and lose the signup flow. Fix: `safeNavigateBack`.
2. Seller Dashboard back button hardcodes `/settings` despite entries from onboarding, push and deep links. Fix: `safeNavigateBack`.

No critical money-path defects. Webhook signatures, server-side Stripe re-verification, idempotency keys, one-order-per-listing unique index and pro-rata refund fee snapshots all verified correct.

## High
3. `stripe-connect-status` returns another seller's `negative_balance_cents` / held funds to any authenticated caller. Fix: return only `ready: boolean` when the target is not the caller.
4. `validate-coupon` derives caller identity by base64-decoding the JWT without verification. Fix: use `auth.getUser()` (charge-time check is already safe).
5. Accepted offers do not reserve the listing - another buyer can buy at full price during the 24h window. Fix: soft-reserve (`reserved_for`/`reserved_until`) checked at checkout, plus a "you lost the item" notification.
6. `SidebarTrigger` icon button has no accessible name.
7. 35+ icon buttons overridden to h-6/h-7/h-8, below the 44pt touch target.
8. 12 files hardcode raw Tailwind colours instead of design tokens (incl. user-facing SellerDashboard, PaymentMethodsSection, OrderReceiptDialog).

## Medium
9. `auto-approve-refund-requests` has `verify_jwt = false` and no `x-cron-secret` check - anyone can trigger the refund batch.
10. Money-moving functions still emit `Access-Control-Allow-Origin: *` instead of `buildCorsHeaders`.
11. Tracking sync can move an `awaiting` order straight to `delivered`, skipping `shipped` and its notification.
12. No `payout.paid` / `payout.failed` webhook handler, so sellers never get payout confirmation.
13. Privacy Policy lacks a Notifiable Data Breaches clause; Terms lack a complaints/dispute-resolution clause with an SLA.
14. `blast` offers duplicate `create_offer` validation in a second code path (drift risk).
15. `useOffers` caps at 300 rows with no pagination.
16. `Offers.tsx` polls every 60s even when backgrounded.
17. Account-deletion eligibility logic duplicated client and server.
18. Disputes notify but never set a `disputed` order status, so sellers still see "delivered".

## Low
19. Em dashes in `shipping-reminders` push copy (lines 222, 235).
20. Inconsistent notification title casing (Title Case vs sentence case, ~15 sites).
21. Missing/inconsistent punctuation in shipping reminder copy.
22. FAQ does not distinguish the 48h dispute window from the 48h auto-release window.
23. Fee math duplicated across 3 files (constants currently consistent).
24. Schema-drift fallbacks silently drop columns with no telemetry.
25. Sales.tsx does not surface the bundle shipping/fee breakdown to sellers.
26. Mint palette contrast not measured; run axe/Lighthouse.
27. Ad hoc Android/`max-[375px]` CSS hacks and hardcoded px in toast styles.

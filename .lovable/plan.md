## Why the score is stuck at 87

The audits are not failing to register progress. Each pass confirms the previous fixes held — fees are consistent, refunds are idempotent, webhooks verify signatures, payouts withhold held funds, no money endpoint is unauthenticated. The score stays flat because the audit scope keeps expanding: every time one category is cleaned, the next pass looks deeper and finds new issues that were always there but not yet inspected.

This is the expected shape of a mature product audit. 87/100 means the app is solid at the surface and the remaining gaps are real but narrow. The way out is not "audit harder"; it is to stop score-chasing and start release-gating.

---

## Proposed plan: release-gating sprint

### Goal
Move from "what else is wrong?" to "these specific things must be true before we ship." Lock the audit scope to one final pass after this sprint.

### Phase 1 — Critical blockers (do first)
These four items from the latest audit are the only ones that can create legal exposure or break a native purchase path:

1. **Fix the 48-hour refund clock** (`OrderDetailsSheet`, `SalesDetailsSheet`). Replace `differenceInDays >= 2` with a real 48-hour timestamp comparison. This is a written promise the app currently breaks.
2. **Remove "Stripe" from buyer-facing refund copy and receipts** (`RefundSystemMessage`, `OrderReceiptDialog`). Use "payment provider" and a generic secured-payment mark.
3. **Replace native `confirm()` popups with Flea AlertDialogs** (`BrandAutocomplete`, saved-card delete in checkout/profile, admin brands/listings). On iOS these can be suppressed and block card removal.
4. **Document or remove the 10-day lost-in-transit refund rule** (`OrderDetailsSheet`, `Terms`, `FAQ`). A refund right that exists only in code is a compliance risk.

### Phase 2 — Backend hardening (do in parallel with Phase 1)
- Add rate limiting to `validate-coupon`.
- Validate UUIDs before interpolating `orderId` into service-role PostgREST queries in `stripe-connect-refund` and `finalize-checkout`.
- Cap `items.length` in `stripe-connect-payment-intent`.
- Add explicit `verify_jwt` entries in `supabase/config.toml` for the 19 functions that currently rely only on in-code auth.

### Phase 3 — UX consistency pass
- Standardise back arrows: ChevronLeft everywhere.
- Gate "No messages yet" on loading state in chat screens.
- Add visible labels to checkout address fields.
- Show the "no cancellations" term at the point of sale.
- Converge confirmation-dialog widths and button heights.

### Phase 4 — Final verification
- One targeted audit pass checking only the items above.
- If clean, freeze the audit and ship. Do not run another open-ended full-product audit unless the product changes significantly.

---

## What this plan does not include

- Another broad "find everything" audit. That is the activity that keeps the score at 87.
- Rewriting large flows that already work (checkout, onboarding, messaging).
- Chasing every nice-to-have in the latest report.

---

## Decision needed

Do you want to:

A) Run this release-gating sprint — fix the four critical items and the backend hardening, then lock the audit.
B) Keep auditing deeper until the score crosses a specific number (e.g. 95). This will keep finding new issues and the score may not move much.
C) Ship as-is and treat 87/100 as good enough for a marketplace beta, fixing only the legal/copy items.

Which path do you want?
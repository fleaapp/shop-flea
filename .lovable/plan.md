# Tighten seller payout and bank-detail safety

You already have the core protections: all seller funds are held until the order is delivered and the 48-hour buyer protection window closes, tracking is required, unshipped orders auto-refund at day 8, and payouts are blocked while any sale is still in protection. This plan closes the four remaining gaps around bank details and identity.

## 1. Proactively validate the bank account (no extra cost)

When a seller adds or changes bank details, and on each dashboard load, read the bank account's validation status from the payment provider (part of the normal account read - no per-call fee).

- `new` - show "Bank account being checked" and keep payouts held.
- `validated` / `verified` - normal state.
- `errored` - show a clear "Your bank details were rejected - please re-enter them" banner and block payout attempts until fixed.

This catches typos and dead accounts before a payout ever fails.

## 2. Handle failed payouts properly

Today a failed payout only sends a generic notification. Add:

- A persistent "Payout failed - check your bank details" banner on the Seller Dashboard with a direct button to update the account.
- Store the failure reason and count on the seller profile.
- Funds automatically return to Available so the seller can retry after fixing details.

## 3. Limit bank-detail churn

- Record every bank-detail change with a timestamp.
- After a bank change, the next payout is held for 24 hours (a "cooling off" window) rather than paying instantly.
- Two or more failed payouts, or three or more bank changes in 30 days, flags the account for admin review and pauses instant payout until cleared. The flag surfaces in the Admin Dashboard.

## 4. Identity anchor when risk signals appear

Keep onboarding light (Vinted/Depop style) but require the ID document upload automatically when any of these are true, not just when the provider asks:

- A payout has failed for a name/account mismatch.
- The account has been flagged by rule 3 above.
- The seller has an active report strike or dispute.

Until the ID is uploaded and accepted, the seller can still sell but cannot withdraw.

## Seller-facing copy

All messages stay plain and non-accusatory - e.g. "We couldn't send your payout. Please double-check your bank details and try again." No jargon, no external links, everything handled in-app.

## Technical notes

- New profile columns: `bank_status`, `bank_last_changed_at`, `bank_change_count_30d`, `payout_failure_count`, `payout_failure_reason`, `payout_review_flag`.
- `stripe-connect-status` extended to return the external account status; `stripe-connect-add-bank` stamps the change timestamp/count.
- `stripe-webhook` `payout.failed` handler writes the failure reason, increments the counter, and restores balance.
- `stripe-connect-payout` gains guards for `bank_status !== errored`, the 24h post-change cooling window, and `payout_review_flag`.
- Seller Dashboard gains the bank-status and payout-failure banners; Admin Dashboard gains a "Payout review" list with a clear-flag action.

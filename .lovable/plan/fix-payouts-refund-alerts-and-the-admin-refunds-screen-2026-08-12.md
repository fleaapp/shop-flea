# Fix payouts, refund alerts, and the Admin refunds screen

## 1. The "$0.59 adjustment" - explained (no bug)

Order FL-001010 sold for $4.25 and carried a seller transaction fee of $0.59 (2% + $0.50). When the order was auto-refunded on 12 Aug, the payment provider returned that fee to you, and it lands on the balance as a raw "adjustment" line.

So the three lines on your dashboard are one story: +$3.66 sale (net), -$4.25 refund, +$0.59 fee returned.

Change: label these lines in plain English instead of the raw provider wording - the fee-return line will read "Seller fee refunded - FL-001010" and link to the same sale, so nothing looks unexplained.

## 2. "Pay out to bank" error / "Bank account being checked"

Nothing new is being checked, and nothing changed on your account. Verified in the backend: no bank detail change is recorded, no payout failure is recorded, and no review flag is set. The bank account itself is fine.

What is happening: for Australian accounts the payment provider leaves a bank account permanently marked `new`. That marker never flips to "validated", even after money has already paid out - it is not a review state. Earlier payouts landed because they went out on the provider's own automatic schedule, which never passes through our button. The manual "Pay out to bank" button is the only path that reads that marker, and it treats `new` as "still checking", so it has never been able to succeed.

Fix:
- Only block payouts when the bank account is genuinely rejected (`errored` / `verification_failed`) or when the account has payouts disabled.
- Remove the "Bank account being checked" banner for the `new` state.
- If a payout still fails, show the real provider message and disable the button rather than leaving a dead button that errors.


## 3. No alert when the sale was auto-refunded

Confirmed: the order was auto-refunded at 01:17 on 12 Aug, but no notification rows exist for it for either buyer or seller. The automated refund job writes those notifications without ever checking whether the write succeeded, so a failed insert is swallowed silently and no push is sent.

Fix:
- Check the result of the notification write, retry once, and log a visible entry in the Admin error log if it still fails.
- Send buyer and seller push notifications only after the alert rows exist, so the bell and the push always agree.
- Apply the same check to the other automated refund/return jobs that use this pattern.
- Backfill the missing alerts for the one affected order so it appears in Alerts.

## 4. Admin "Refunds & disputes" screen bugs

Three separate problems in that screenshot:

- **Filter chips overlap the header** - the page is a fixed full-height column, but the list area never scrolls, so the chip row collapses under the sticky header. Fix: make the header and chip row fixed-height, and give the list its own scroll area.
- **Black thumbnails** - the image URLs for those items no longer load. Fix: show a neutral placeholder tile when the image fails or is missing, instead of a black box.
- **Missing buyer names** - those buyers were deleted from the backend, so no profile exists. Fix: show "Deleted user" with a neutral avatar rather than a dash.

Also adding the order code (FL-00xxxx) and a plain-English refund reason to each row so refunds can be matched to transactions at a glance.

## Technical notes

- `supabase/functions/stripe-connect-payout/index.ts`: drop the `bank_checking` 409 for `status === "new"`; keep the `errored` branch; stop persisting `bank_status: 'new'` as a blocking state.
- `src/pages/SellerDashboard.tsx`: remove the checking banner for `new`; map balance-transaction types (`adjustment`, `application_fee_refund`, `stripe_fee`) to Flea copy in `activityMeta`.
- `supabase/functions/auto-refund-unshipped/index.ts`: capture `{ error }` from the notifications insert, retry, log to `error_logs`, gate `firePush` on success. Same pattern in the return/escalation jobs.
- `src/pages/admin/AdminRefunds.tsx`: `shrink-0` on header/chips, `flex-1 overflow-y-auto` on the list, image `onError` fallback, deleted-profile fallback, order number row.

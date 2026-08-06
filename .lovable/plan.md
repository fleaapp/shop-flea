# Remaining open items before launch

Short answer: no, not quite. The Critical and High items from the audit are built and deployed, but five things are still open. Three are decisions only you can make, one is a side effect of the coupon fix that needs cleaning up, and one is a check I have not run yet.

## 1. Test data is still in the database

The database currently holds 12 listings, 12 orders, 7 profiles and 4 offers. Some of that is smoke-test data I created, some may be yours. Deleting it is irreversible, so I left it alone.

Decision needed: purge the test rows, keep everything, or have me list each record so you can pick.

## 2. The coupon fix has locked out two existing accounts

FREEFLEA has been redeemed 18 times across only 2 accounts. Now that redemption is limited to one per account, those two accounts can no longer use the code. If either is an account you test with, or a real early user, the code will silently fail for them.

Fix: clear the historical FREEFLEA redemptions for the test accounts so the limit starts from a clean slate, while leaving the one-per-account rule in force going forward.

## 3. Apple review seller account is a placeholder

The review account was pointed at a demo Stripe account id so reviewers can reach the selling flow. It lets them see and use the seller screens, but it is not a real connected account, so a reviewer who runs a full payout will hit an error rather than a success screen.

Decision needed: leave as is (reviewers rarely go that deep), or gate payout actions behind a friendly "demo account" message for that user.

## 4. Recent error log needs a read-through

There are 14 errors logged in the last three days. Some are likely the recovered chunk-load noise now being filtered, but I have not read them individually. Worth clearing before launch so the log starts empty and any new entry means something real.

## 5. Two audit items intentionally not built

- Seller cancel/refund wording: left exactly as is, per your call.
- The single-seller assertion in checkout finalisation stays at payment-intent time, not after the card is charged. Blocking later would take the money and create no order.
- The 77 hardcoded colour utilities are almost all `text-white` on charcoal buttons, which is the intended brand treatment. Refactoring them now is visual risk for no user benefit.

## Suggested next step

Items 2 and 4 are cleanup I can do immediately and safely. Items 1 and 3 need your decision first.

## Technical detail

- Item 2 is a delete against `coupon_redemptions` filtered to the FREEFLEA coupon and the two test user ids; the `couponAlreadyUsed` check in the shared helper stays unchanged.
- Item 4 is a read of `error_logs` for the last 3 days, then a truncate of the resolved entries.
- Item 3, if actioned, is a client-side guard in the seller dashboard keyed to the review account, not a backend change.

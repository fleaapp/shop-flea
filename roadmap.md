# Launch safeguards

- [ ] Restore legacy seller-profile reads without exposing precise activity timestamps; verify live access and seller screens.

- [x] Make refunds item-specific and protect shipped bundle items.
- [x] Validate return tracking, require Flea delivery review, and retry approved failed refunds.
- [x] Keep disputed refund funds held and align seller response deadlines.
- [x] Recover paid checkouts when order creation fails using private quotes and settlement claims.
- [x] Match seller dashboard protected-balance calculations to payout calculations.
- [x] Implement real block/unblock management and server-side scam-payment filtering.
- [x] Run 12 focused tests; check changed functions; deploy safeguards; verify signed-in block/unblock readback and desktop/mobile screens.
- [x] Add leased payment-event processing, deduplicated alerts and buyer bank-dispute notices.
- [x] Require carrier evidence and shipping permits; reject forged background-tool credentials.
- [x] Remove automatic return-postage coverage promise and clarify existing fee disclosure; reimbursement remains a separate manual review, not an automated payment.
- [x] Hide precise public activity timestamps while preserving the shared 10-day inactivity rule.
- [x] Apply shared popup punctuation/provider wording and replace admin long dashes.
- [x] Distinguish initial loading from empty screens and add retry states; signed-in Wishlist, Alerts, seller and listing retry flows verified.
- [x] Pass 15 focused tests, check payment/tracking/thumbnail functions, deploy five updated functions, and verify live privacy/forged-token/shipping denial checks. Email functions deployed and denied forged callers; full local email typecheck unavailable because the managed email package is absent locally.
- [ ] Verify real checkout, return refunds, payout eligibility and iPhone behavior end-to-end. Blocker: no safe payment/carrier test transaction or iPhone in this sandbox; no real money was moved for testing.
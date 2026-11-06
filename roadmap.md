# Launch safeguards

- [x] Make refunds item-specific and protect shipped bundle items.
- [x] Validate return tracking, require Flea delivery review, and retry approved failed refunds.
- [x] Keep disputed refund funds held and align seller response deadlines.
- [x] Recover paid checkouts when order creation fails using private quotes and settlement claims.
- [x] Match seller dashboard protected-balance calculations to payout calculations.
- [x] Implement real block/unblock management and server-side scam-payment filtering.
- [x] Run 12 focused tests; check changed functions; deploy safeguards; verify signed-in block/unblock readback and desktop/mobile screens.
- [ ] Prevent duplicate payment alerts and notify buyers about bank disputes.
- [ ] Tighten outbound tracking and background-tool authentication.
- [ ] Remove unfunded return-postage promises and reconcile fee disclosure.
- [ ] Limit public last-active detail without changing seller availability.
- [ ] Correct popup punctuation, provider wording and admin dashes.
- [ ] Fix initial loading flashes and add retry states on failed screens.
- [ ] Verify real checkout, return refunds, payout eligibility and iPhone behavior end-to-end. Blocker: no safe payment/carrier test transaction or iPhone in this sandbox; no real money was moved for testing.
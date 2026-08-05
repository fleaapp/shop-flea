# Tracking: reject invalid numbers, AU carriers only, flow review

## Answering the two questions first

**Does it auto-update when a number later becomes valid?**
Yes, partly. The daily reconciliation job re-queries every shipment that isn't delivered yet, so a number the carrier hasn't picked up at first will start showing scans once the carrier registers it - but only once a day, and only for shipments that were successfully created at ship time. If the seller typed the number wrong, it never becomes valid, and today there is no way for the seller to correct it after shipping.

**Is invalid tracking rejected?**
No. Right now anything typed in the box is accepted, the order flips to shipped, and the problem only surfaces a day later as a "check your tracking number" alert. The carrier field is also a free-text box with UK placeholder examples (Royal Mail, DPD, Evri), which pushes sellers toward carriers we can't map.

## What this plan changes

### 1. AU carriers only, chosen from a list
Replace the free-text Service Provider input on the sale details ship form with a picker limited to the main Australian carriers:
Australia Post, StarTrack, Sendle, CouriersPlease, Aramex, TNT, Toll, DHL Express.
No "Other" and no manual entry - every option maps to a known carrier code, which is what makes lookups reliable.

### 2. Reject invalid tracking at ship time
Two layers, both before the order flips to shipped:
- Format check in the app: per-carrier pattern (for example Australia Post `XX123456789AU` / 33-prefixed, Sendle `S…`, StarTrack numeric). Clear inline message on failure.
- Live check with the tracking provider: submit the number and carrier, and if the carrier rejects it as an unknown number, block the submit with "That tracking number wasn't recognised by <carrier>. Check it and try again." Brand-new labels that the carrier hasn't scanned yet are still accepted - only outright rejections block.

### 3. Faster auto-recovery, and a way to fix a wrong number
- Re-check unresolved shipments hourly for the first 48 hours instead of only once a day, then fall back to daily. Once scans appear, the shipment updates itself and the alert state clears.
- Add an "Update tracking number" action on the sale details drawer for shipped-but-not-delivered orders, so a seller who mistyped can correct it. Correcting re-registers the parcel and clears the flagged state.
- Keep the existing seller alert as a backstop when the carrier still has no record after 24 hours.

### 4. Flow review findings to fix in the same pass
- The buyer's tracking display should show the live carrier status alongside the number, not just the raw number.
- Bundle orders: confirm one shipment row covers the whole group and delivery advances every order in the group (currently written that way - will verify against real rows).
- Payout gating is already correct: funds for orders that are awaiting, shipped, or inside the 48-hour window are excluded from both instant and standard payouts. No change needed.
- Carrier-confirmed delivery only ever moves orders forward and never touches refunded, cancelled, or completed orders. No change needed.

## Technical notes

- New shared `AU_CARRIERS` list (label, tracking-provider code, validation regex) used by the ship form and by the shared carrier-code mapper, so the app and backend agree on names.
- `tracking-register` gains a validate-only mode: it returns a rejection instead of writing anything, so the ship form can call it before `mark_order_shipped` runs.
- `tracking-sync` gets a two-tier cadence (hourly for shipments under 48 hours old and not yet scanned, daily otherwise) via a second cron entry with a narrower query.
- New `tracking-update-number` path: verifies the caller is the seller, revalidates, rewrites the shipment row, and re-registers with the provider.
- Sale details ship form gets a select control plus inline validation state; the submit button stays disabled while validation is in flight.

## Short answer

The message isn't wrong, but it's misleadingly rigid. Refund speed is decided by the buyer's bank, not by Flea:

- Many cards (especially Apple Pay / modern digital-first banks) post the reversal **instantly or within minutes**, which is what you saw.
- Traditional credit cards and some debit cards can take **up to 5-10 business days** to show the credit.

So "Funds will appear in 5 to 10 days" reads as a promise of a delay that often doesn't happen, and it also conflicts with the wording already used elsewhere in the app.

## Current inconsistency (verified)

Three different timings are in use today:

- `auto-refund-unshipped` buyer notification: "Funds will appear in 5 to 10 days."
- `stripe-connect-refund` buyer notification: "within a few business days"
- Seller-side toast in `OrderChat`: "Buyer will see it in 5-10 days." (also uses a long dash, which breaks the copy rule)

## Proposed change

Standardise on one buyer-facing phrase that covers both instant and slow banks:

> "Funds usually appear straight away, but some banks can take up to 5 business days."

Edits:

1. `supabase/functions/auto-refund-unshipped/index.ts` - update the buyer notification message (and the matching push payload) to the new phrase; redeploy the function.
2. `supabase/functions/stripe-connect-refund/index.ts` - align the buyer refund notification to the same phrase; redeploy.
3. `src/pages/OrderChat.tsx` - update the seller toast to "Refund processed. The buyer usually sees it straight away." and replace the long dash with a short dash.
4. Sweep FAQ/Terms refund sections for any other "5 to 10 days" style promise and align.

No logic, fee, or refund-flow changes - copy only.

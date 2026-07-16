## Fix coupon UX so invalid codes fail visibly

Only one behaviour change: when the buyer enters a code that doesn't match a live coupon, tell them immediately instead of silently doing nothing at checkout. Keep the code strict as `FREEFLEA` only.

### Root cause

`validate-coupon` and the checkout functions already return a `valid: false` payload for unknown codes, but `CouponInput.tsx` doesn't show that message strongly enough, so the buyer thinks the code applied. On top of that, the server accepts submission without a coupon and quietly charges the full fee.

### Changes

- `src/components/CouponInput.tsx`
  - When `validate-coupon` returns `valid: false`, show a clear inline error ("Invalid or expired code") in the input's error slot and never call `onChange` with a fake applied coupon.
  - Clear the error the moment the buyer edits the field again.
- `supabase/functions/validate-coupon/index.ts`
  - Make the lookup case-insensitive and trim whitespace, so `freeflea`, ` FREEFLEA `, etc. still match `FREEFLEA`. Genuine typos like `FLEAFREE` still fail.
  - Return a consistent `{ valid: false, message: "Invalid or expired code." }` for anything not found / not active / expired / fully redeemed.
- `supabase/functions/stripe-connect-payment-intent/index.ts` and `supabase/functions/stripe-connect-checkout/index.ts`
  - Same trim + case-insensitive match on the server so the applied-in-UI state and the charge always agree.
  - Add a debug log line (`[coupon] code=... matched=... fee=...`) so if this happens again we can confirm from function logs exactly what the server received.

### Not doing

- No alias for `FLEAFREE` (per your answer).
- No change to who pays the fee refund — behaviour is already correct: Stripe returns Flea's application fee to the buyer, seller's transfer is reversed, Stripe returns its own processing fee.

### Verification

- Try `FLEAFREE` at checkout → inline "Invalid or expired code", no fake applied state, full fee still charged (expected).
- Try `FREEFLEA` (and `freeflea`) at checkout → applied, buyer fee = $0, Stripe payment intent created with `application_fee_amount: 0`.
- Check the payment-intent function logs to see the new `[coupon]` line reflect the actual matched coupon.

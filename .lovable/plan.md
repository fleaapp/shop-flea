## On the 10-day refund window (C2C context)

You're right that in a genuine C2C marketplace, ACL consumer guarantees don't automatically apply to private sellers — they only bind sellers acting "in trade or commerce". Stripe forcing users to sign up as a business is a **KYC/tax classification**, not a legal declaration that they're a trader for ACL purposes. So most of your sellers are still legally C2C.

**Recommendation: keep the 10-day window as-is, but tighten the language and add an escalation path.**

Why:

- 10 days post-delivery is already **more generous than eBay's 3-day "item not as described" default** and matches Depop / Vinted's window. It's an industry-normal C2C standard.
- Removing it would expose casual sellers to open-ended return risk, which kills the C2C proposition.
- The residual legal risk (a repeat/business-scale seller being caught by ACL) is handled by a **support escalation channel**, not by extending the app window for everyone.

Specifically I'd:

1. Keep the 10-day self-service window in the app.
2. In Terms cl. 10, add a sentence: *"If you believe the seller was acting in trade or commerce and you have a claim under the Australian Consumer Law that falls outside the 10-day window, contact support and we will assist."*
3. Add a "Contact support" link on the closed-refund-window state in OrderChat.
4. Add one line to Terms cl. 8 clarifying most Flea sellers are private individuals and ACL guarantees may not apply to private sales — this is transparent and legally accurate.

No code change needed to the 10-day logic itself.

---

## Fee restructure

**New model:**


| Before                                                     | After                                              |
| ---------------------------------------------------------- | -------------------------------------------------- |
| Buyer: 1.75% + $0.30 "Payment processing fee" (grossed up) | Buyer: **4% + $0.70 "Secure Checkout Fee"** (flat) |
| Seller: 7% platform fee                                    | Seller: **$0 — no selling fees**                   |


Money flow per sale:

- Buyer pays: `items + shipping + (subtotal × 4% + $0.70)`
- Stripe still deducts its real ~1.75% + $0.30 from the charge (via `on_behalf_of=seller`)
- Flea's `application_fee_amount` = the full Secure Checkout Fee (Flea earns whatever's left after Stripe's cost)
- Seller receives: `items + shipping` in full (Stripe cost absorbed by the buyer-paid fee)

Worked example on a $50 item + $10 shipping:

- Before: buyer $61.37, seller nets ~$55.80, Flea ~$4.20
- After: buyer $63.10, seller $60.00 (full), Flea ~$1.55 after Stripe cost

Note: **Flea earns less per transaction under this model** — that's your business call, flagging it so you're aware.

## Files to change

**Core math** — `src/utils/feeCalculator.ts`

- Replace `STRIPE_PROCESSING_RATE/FIXED` + `PLATFORM_FEE_RATE` with `SECURE_CHECKOUT_RATE = 0.04`, `SECURE_CHECKOUT_FIXED = 0.70`, `PLATFORM_FEE_RATE = 0`.
- `processingFee` → renamed to `secureCheckoutFee`; formula = `subtotal * 0.04 + 0.70`.
- `sellerReceives` = `subtotal` (no deduction).
- `rateLabel` = `"4% + $0.70"`.
- `sellerEarningsPreview(price, shipping)` → returns `price + shipping` (no fee subtracted).

**Server-side** — `supabase/functions/stripe-connect-checkout/index.ts`

- Remove the 7% platform-fee-dollars calculation.
- Compute `secureCheckoutFee = subtotal * 0.04 + 0.70`.
- `application_fee_amount` = `secureCheckoutFee` in cents.
- Update metadata: replace `platform_fee_aud` with `secure_checkout_fee_aud`.

**Checkout UX** — `src/pages/Checkout.tsx`

- Change the fee line label from "Payment processing fee (1.75% + $0.30)" to **"Secure Checkout Fee (4% + $0.70)"**.
- Add a small `ⓘ` icon button next to the label opening a Popover:
  > *"*A small fee that helps us provide secure transactions, fraud prevention & marketplace support so you can shop with confidence. No hidden extras - Flea sellers pay no selling fees.*"*
- Uses the existing shadcn `Popover` for consistency with `ConditionInfoPopover`.

**Buyer-facing receipts** — `src/components/OrderReceiptDialog.tsx`, `src/components/OrderDetailsSheet.tsx`

- Rename "Processing fee (1.75% + $0.30)" → "Secure Checkout Fee (4% + $0.70)".
- Remove the "Platform fee (7%)" line from `OrderReceiptDialog` (it was showing a seller-side deduction to the buyer, which no longer exists).

**Seller-facing** — `src/components/SalesDetailsSheet.tsx`

- Remove the "Platform fee (7%)" line and the deduction.
- Show `You received: items + shipping` in full.

**Listing earnings preview** — wherever `sellerEarningsPreview` is called (edit/create listing, listing details)

- Since the helper now returns full `price + shipping`, copy that reads "You'll receive $X after fees" should be simplified to "You'll receive $X" — I'll grep and adjust.

**FAQ** — `src/components/FAQSection.tsx`

- Update "What fees do I pay as a buyer?" → describe the new 4% + $0.70 Secure Checkout Fee and what it covers.
- Update "What fees do I pay as a seller?" → **"Flea charges no selling fees. You receive the full item price plus shipping. Payment processing is covered by the buyer's Secure Checkout Fee."**

**Terms** — `src/pages/Terms.tsx`

- Clause 7 (Fees): remove the 7% platform-fee bullet, add a Secure Checkout Fee line.
- Clause 8: add C2C clarification about ACL/trade-or-commerce.
- Clause 10: add the support-escalation sentence for out-of-window ACL claims.

**Admin transaction display** — `src/components/admin/transactions/TransactionTable.tsx`, `TransactionDetail.tsx`

- Update column headers/labels from "Platform fee" to "Flea revenue" (or keep as `platform_fee` internally, just relabel — the value will now equal the Secure Checkout Fee minus Stripe's cost).

**Refund handling** — `supabase/functions/stripe-connect-refund/index.ts`

- Comment update only: `refund_application_fee: true` still correctly unwinds Flea's fee (now the Secure Checkout Fee rather than the 7%). No logic change.

## What I'll not change

- The 10-day refund window logic in `stripe-connect-refund` (still enforced).
- The auto-refund at 6 days overdue.
- Stripe Connect account structure — sellers still onboard as businesses per Stripe's KYC requirement; that's separate from the ACL trade/commerce question.
- Existing orders' historical fee data — the change is prospective only.

## Open question

Do you want the **new fee applied retroactively to already-created but unpaid checkout sessions**, or only to sessions created from the moment we deploy? (Recommend: only new sessions — no code needed, just deploy.)
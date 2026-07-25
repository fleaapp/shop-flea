## Add Seller Transaction Fee: 2% + $0.50

Introduce a seller-paid **Transaction Fee (2% + $0.50)** alongside the existing buyer-paid Secure Checkout Fee (4% + $0.70). Sellers still have no listing fees — this is a per-sale processing fee deducted from their payout, mirroring Depop/Vinted's model. It also finally makes Flea profitable per order (covers Stripe's ~1.75% + $0.30 processing).

### Money flow (per sale)
```text
Buyer pays:    items + shipping + Secure Checkout Fee (4% + $0.70)
Seller earns:  items + shipping − Transaction Fee (2% + $0.50)
Flea revenue:  Secure Checkout Fee + Transaction Fee − Stripe processing
```

### 1. Fee engine (source of truth)
- `src/utils/feeCalculator.ts`: add `TRANSACTION_FEE_RATE = 0.02`, `TRANSACTION_FEE_FIXED = 0.50`. Extend `FeeBreakdown` with `transactionFee`, update `sellerReceives = subtotal − transactionFee`, keep `platformFee` (now = secureCheckoutFee + transactionFee for reporting).
- `src/types/admin/transactions.ts`: add `calcTransactionFee(subtotal)`; update `calcPlatformFee` doc; keep backward-compat exports.
- `sellerEarningsPreview(price, shipping)` → subtract transaction fee so listing previews show accurate take-home.

### 2. Checkout / payment flow
- `supabase/functions/stripe-connect-checkout/index.ts`: compute `transactionFee` on the subtotal, set `application_fee_amount = round((secureCheckoutFee + transactionFee) * 100)`. Store `transaction_fee_aud` in session metadata. `FREEFLEA` continues to waive only the buyer fee; transaction fee always applies.
- `supabase/functions/finalize-checkout/index.ts` (and any webhook that persists order totals): persist `transaction_fee` per order for accurate ledgers/receipts.
- `supabase/functions/stripe-connect-refund/index.ts` & `auto-refund-unshipped/index.ts`: keep `refund_application_fee: true` (per your preference) — both fees returned on refund. No behavioural change beyond math.

### 3. Database
- Migration: add `orders.transaction_fee NUMERIC(10,2) DEFAULT 0`. Backfill existing rows to 0 (historical orders had no seller fee). GRANT unchanged (inherits from table).

### 4. Seller-facing UI
- **Seller Dashboard** (`src/pages/SellerDashboard.tsx`): payout activity rows show `− Transaction fee $X.XX` line; balance calculations already read from Stripe so no change there, but add a "Fees" tooltip explaining 2% + $0.50 per sale.
- **Sale Details Sheet** (`src/components/SalesDetailsSheet.tsx`): add line "Transaction fee (2% + $0.50): −$X.XX" between subtotal and "You receive".
- **Order Receipt** (`src/components/OrderReceiptDialog.tsx`): add seller-side transaction fee line when viewed by seller.
- **Create/Edit Listing** earnings preview: reflect new `sellerEarningsPreview`.
- **Settle Balance / Payouts UI**: no logic change, but include fee explainer.

### 5. Buyer-facing UI
- No math change (buyer still pays 4% + $0.70). No copy change needed on checkout/cart.

### 6. Info popovers & content
- New `SellerTransactionFeeInfoPopover.tsx` (mirrors `SecureCheckoutInfoPopover`) used wherever the seller fee appears.
- **FAQ** (`src/components/FAQSection.tsx`): add/update entries — "Does Flea charge sellers?" → yes, 2% + $0.50 transaction fee per sale, no listing fees. Update any "no seller fees" wording.
- **Terms** (`src/pages/Terms.tsx`): add Transaction Fee clause under Fees section.
- **Privacy Policy** (`src/pages/PrivacyPolicy.tsx`): no change unless current copy asserts "no seller fees"; scrub if so.
- **Seller Onboarding Sheet** (`src/components/SellerOnboardingSheet.tsx`): step 1 copy update — "Listing on Flea is free. A 2% + $0.50 transaction fee applies per sale."
- **About page**, **marketing copy**, any "sellers pay nothing" strings: replace with "no listing fees" wording.

### 7. Admin
- `src/components/admin/transactions/TransactionDetail.tsx` + `TransactionSummaryBar.tsx`: show transaction fee column and roll into platform earnings total.
- `useAdminTransactions.ts`: include `transaction_fee` in queries; `platformEarnings = secureCheckoutFee + transactionFee` per order.

### 8. Memory
- Update `mem://infrastructure/payment-model-and-fees` and Core rule ("Sellers pay no fees" → "Sellers pay 2% + $0.50 transaction fee, no listing fees").

### Technical notes
- All monetary rounding via existing `r2` helper.
- `application_fee_amount` change is the only Stripe-side behavioural shift — existing destination-charge + `on_behalf_of` setup unchanged.
- No breaking change to old orders (fee defaults to 0, receipts render conditionally).
- Copy rule: never say "Stripe" — use "payment providers" / "processing".

### Out of scope (confirm if wanted)
- Changing `FREEFLEA` to also waive the seller fee.
- Raising the buyer Secure Checkout Fee.
- Retroactive fee application to historical orders.
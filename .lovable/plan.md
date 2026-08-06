# Flea - Full Product Audit

Five specialist reviews (copy/legal, offers/orders/refunds, payments/shipping, UX/UI/navigation, security/performance) plus a notification pass. Every finding below was verified against real file contents, live database policies or live data. Items that could not be confirmed are labelled unverified.

**Overall Product Health: 78/100. Not launch-ready today.** Four critical issues, all fixable in a focused pass. The architecture is sound - money never moves without a verified payment, RLS is tight, fee math is consistent everywhere. The gaps are in state-machine edge cases and a handful of copy/legal slips.

---

## Critical - must fix before release

**C1. Multiple buyers can hold an accepted offer on the same one-of-a-kind item**
Screens: Offers, Checkout. Users: Buyer, Seller.
`respond_to_offer` locks only the offer row being accepted. It never checks whether another buyer already holds an accepted offer on that listing. A seller "blast" sends the same discount to up to 50 buyers, and every one of them can accept. Each is told "It's in your cart, pay within 24 hours." All can reach real payment. Only the first insert wins; the rest are charged and then auto-refunded.
Impact: several buyers charged for one item, then refunded. Trust damage, support load, card-hold complaints.
Fix: refuse acceptance if a live accepted offer or reserved order already exists on the listing, plus a partial unique index allowing one accepted offer per listing. Complexity: Medium.

**C2. Seller funds can release while a refund request is still open**
Screens: Sales, Orders. Users: Buyer, Seller.
`auto_complete_delivered_orders` completes any delivered order once the 48h dispute window passes, without checking `refund_requested_at`. A buyer who requests a refund at hour 47 gets a 72h seller-response deadline that outlives the dispute window, so the order completes and funds release mid-dispute. The later refund then forces a transfer reversal that can fail and become seller debt.
Impact: buyer protection does not hold in exactly the case it exists for.
Fix: exclude orders with an open refund request from auto-completion, or extend the dispute window when a request is opened. Complexity: Medium.

**C3. Payment-bypass account is hardcoded in the shipped client bundle**
Screens: Checkout. Users: anyone.
`REVIEWER_USER_ID = '5883f33c-...'` appears in both `src/pages/Checkout.tsx:44` and `stripe-connect-payment-intent/index.ts:29`. That account skips payment entirely and inserts real order rows. The UUID is visible to anyone who reads the JS bundle.
Impact: a live financial-abuse vector keyed to a public identifier.
Fix: move the bypass to a server-only `profiles.is_apple_reviewer` flag, never referenced client-side. Complexity: Medium.

**C4. Home feed shows a blank screen while loading**
Screen: Index (`src/pages/Index.tsx:561`). Users: all.
The loading branch renders an empty div - no spinner, no skeleton, no copy. On a slow connection the most important screen in the app looks frozen or broken.
Impact: direct first-impression and conversion loss.
Fix: reuse the existing `ListingGridSkeleton` pattern. Complexity: Small.

---

## High priority

**H1. FREEFLEA can still be redeemed twice**
The uniqueness constraint on `coupon_redemptions` is `(coupon_id, checkout_reference)`, not `(coupon_id, user_id)`. Two tabs produce two different payment references, so both pass the application-level check before either writes a redemption row. The redemption write also happens after payment in a try/catch that swallows failures.
Fix: add `UNIQUE(coupon_id, user_id)` and write the redemption in the same transaction as the order. Complexity: Medium.

**H2. "Refund sale" on a bundle refunds the whole bundle**
`SalesDetailsSheet` calls the refund function with no `mode`, which defaults to cascade and refunds every order sharing the group id. Every other refund path correctly passes `mode: "single"`. A seller refunding one bad item in a three-item sale silently refunds all three.
Fix: pass `mode: "single"`, or add the item picker used by the pre-shipment flow. Complexity: Small.

**H3. Any username can be turned into an email address, with no rate limit**
`get_email_by_username` is SECURITY DEFINER with EXECUTE granted to PUBLIC and is called before login. Usernames are public. An unauthenticated attacker can harvest the email of every account.
Fix: rate-limit it via the existing `check_and_record_rate_limit`, or move it behind an edge function that returns a masked hint. Complexity: Small.

**H4. Refund after payout is not detected in real time**
`negative_balance_cents` is only refreshed when the seller happens to open a screen that calls the status function. Nothing updates it on a `charge.refunded` webhook. A seller can withdraw, get refunded against, and keep selling on a stale balance.
Fix: update the balance server-side in the Stripe webhook handler. Complexity: Medium.

**H5. Stripe is named in the Privacy Policy in four places**
`PrivacyPolicy.tsx:63, 100, 126, 236`. This breaks the brand rule, but naming the actual data processor is arguably required for a truthful APP-6/APP-8 disclosure.
Recommendation: rename the visible label to "our card-payment provider" while keeping the working privacy link. If legal requires the entity name, keep it and treat the Privacy Policy as an explicit exception to the brand rule - this one needs your decision. Complexity: Small.

**H6. Em dashes in buyer- and seller-facing copy**
`Checkout.tsx:352`, `IdVerificationStep.tsx:277`, `RefundRequestDialog.tsx:280`, `SalesDetailsSheet.tsx:770`, `OrderDetailsSheet.tsx:565`, plus em-dash placeholders in `SellerDashboard.tsx:130` and `PaymentMethodsSection.tsx:301`.
Fix: replace with short dashes. Complexity: Small.

**H7. Listing forms lose everything on back**
`CreateListing.tsx` and `EditListing.tsx` wire the back chevron straight to navigation with no dirty check. A seller who has entered images, price, brand and description loses it all on one tap.
Fix: dirty-state tracking plus a "Discard changes?" dialog. Complexity: Medium.

**H8. Sixteen icon-only buttons have no accessible name and sit under 44px**
Worst: `OrderChat.tsx:307` (no padding, no label), `SuggestionBox.tsx:56`, `EditProfile.tsx:284`. Screen readers announce a bare "button" on those screens.
Fix: standardise on `Button variant="ghost" size="icon" aria-label="Back"` - the pattern already used correctly across the admin screens. Complexity: Medium.

**H9. Delete Account uses a non-standard dialog**
`EditProfile.tsx:477` stacks the buttons vertically with Delete above Cancel, inverting the convention used by every other confirm dialog in the app. The single most destructive action is the least consistent one and the easiest to mis-tap.
Fix: restandardise to the house dialog style, Cancel left, destructive right. Complexity: Small.

---

## Medium priority

- **M1. Pausing a listing kills live accepted offers.** The void trigger fires on any non-active status, so an unpause seconds later does not restore the buyer's price. Restrict voiding to sold/removed/deleted.
- **M2. Charged with no order for up to 30 minutes.** If order creation throws after a successful charge, the client retries for 7.5s, then the buyer waits for a cron that only refunds (never retries) payments older than 15 minutes. Add a fast retry path before falling back to refund.
- **M3. Order creation is a select-then-insert race.** Two tabs finalising the same payment can both pass the duplicate check; correctness depends entirely on a DB constraint. Use `INSERT ... ON CONFLICT DO NOTHING` and confirm a unique constraint on `checkout_reference`.
- **M4. Seller cancel is two non-atomic calls.** If the network drops between the status RPC and the refund call, the order sits cancelled-but-unrefunded with no sweep to recover it.
- **M5. Stuck refunds are invisible.** A failing refund cron leaves the order in limbo with no badge for the buyer, seller or admin. Add a "refund delayed" filter in Admin Refunds.
- **M6. Overdue banner copy says 3 days, the code fires at 4** (`SellerDashboard.tsx:463` vs `:256`). The FAQ separately mixes 3/6/8-day reminders with the 4-day flag in one paragraph.
- **M7. Storage buckets have no size or MIME limits.** Client-side validation only; an anon key plus curl can push arbitrary large files into the public listings bucket. Set `file_size_limit` and `allowed_mime_types`.
- **M8. Expired-but-pending offers render as "Closed" instead of "Expired"** (`Offers.tsx:28`), because the label map has no `pending` entry.
- **M9. Home feed selects every column** including description, tags and all images, for a card that shows five fields.
- **M10. Facebook sign-in still renders and dead-ends in a toast** (`Auth.tsx:614`). Remove it or mark it coming soon.
- **M11. Password reset drops the redirect param**, so a buyer who forgets their password mid-checkout does not return to checkout.
- **M12. No cooling-off disclosure in the Terms**, while clause 7 says buyers cannot cancel. Add an explicit line saying ACL cooling-off for unsolicited agreements does not apply to marketplace goods purchases.
- **M13. Carrier tracking regex may reject valid numbers** for AusPost eParcel and TNT con-notes. Unverified - needs testing against real sample numbers before changing.

## Low priority

- Guest gate replaces the whole page instead of explaining what is locked.
- Wishlist loads with a "⏳" emoji while Profile uses a proper skeleton.
- Carrier "exception" events are stored but nobody is notified.
- Hourly tracking sync only re-checks parcels with no first scan, so a stuck in-transit parcel waits for the daily sweep.
- Counter-offer round cap is enforced but never explained to either side.
- Admin Refunds has no "declined" filter, despite buyers being told they can escalate.
- Delivered orders with no dispute window set hold funds forever - safe, but needs a backfill.
- "Remove" is used for four different actions of very different severity in `ListingDetails.tsx`.
- 10MB and 8.5MB GIFs plus 1.8MB SVGs in `src/assets`.
- Four independent 30-60s polls run in parallel when Orders, Offers and Support are all mounted.
- Dead `mockListings.ts` and internal fee-naming drift (platformFee vs transaction_fee).

## Verified clean

Fee math is identical across client, payment-intent and finalize-checkout, with cent-exact enforcement - no 7% anywhere. All refund and buyer-protection timings agree across Terms, FAQ and the UI. All 19 live notification types have icon, copy and routing. No cross-user read or write path exists on any user-data table. Storage policies are correctly owner-scoped. No admin surface relies on a client-side check. No secrets in the client bundle. Hot-path indexes match the actual queries. Offer expiry is enforced server-side at checkout. Instant-payout fee failure cannot short the seller. GST, ACL, dispute resolution, data retention and merchant-of-record disclosures are all present.

---

## Launch readiness

**Blockers:** C1, C2, C3, C4, plus H1 and H2.
**Highest payment risk:** the offer double-purchase (C1) and the coupon race (H1) - both charge real buyers.
**Highest legal risk:** the Stripe naming decision (H5) and the missing cooling-off line (M12).
**Highest UX risk:** the blank home feed (C4) and silent listing-form data loss (H7).
**Quick wins:** C4, H2, H6, H9, M8 and M10 are all small and directly improve trust and conversion.

## Suggested build order

1. Critical block: C1, C2, C3, C4.
2. Money integrity: H1, H2, H4, M2, M3, M4.
3. Trust and polish: H6, H7, H8, H9, M6, M8, M10, M11.
4. Hardening: H3, M7, M5, M1.
5. Legal: H5 and M12 after your decision on the Stripe naming question.

I have not changed any code. Approve this and I will work through it in that order, or tell me which sections to build and which to skip.

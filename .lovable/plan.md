# Fix reports, comments, offers layout, reviews, notifications and seller gating

## 1. Seller profile header position

The back and menu buttons sit in an absolutely positioned row at the very top of the screen, so they ignore the safe-area inset that other screens apply. Move them into the normal page flow with the same safe-area top padding used elsewhere so they line up with the rest of the app.

## 2. Reports are blocked by a database guard (confirmed cause)

Submitting a report inserts a row into `reports`, which fires a trigger that increments `report_count` on the listing (or the reporter strike count on a profile). The listings guard rejects any change to `report_count` unless the caller is the service role, so the whole insert fails with "Modification of protected listing fields is not allowed".

Fix: allow the report trigger to update those counters while keeping normal users blocked - the guard will skip the check when the update comes from the trigger's elevated context, not from a user edit. Same treatment for the profile strike counter and comment report counter. Reports for listings, users and comments will then submit correctly.

## 3. Comment three-dot menu

The menu already renders Report and Remove, but the actions fail: report hits the blocked insert above, and delete is only allowed for the comment author or the listing owner via database rules that need checking. After the report fix:

- Report: available on anyone else's comment, opens the existing report dialog, hidden on your own comment.
- Delete: shown to the comment author and to the listing owner, with a confirm step, and verified against the database delete rules so listing owners can actually remove comments on their listings.

## 4. Tagged usernames go nowhere

Mentions link to `/seller/@username`, but the seller profile screen only looks users up by internal ID, so it always shows "Seller not found". Fix by making that screen accept either an ID or an `@username`, looking the username up case-insensitively. Any tagged user then opens, seller or not; the screen already handles users with no listings.

## 5. Seller onboarding gating

Add a single reusable check: when a user without completed seller setup taps any seller-only action, open the existing seller onboarding sheet instead of the action. Applies to: Seller Dashboard entry, Sales screen, Offers "Seller" side, pause-selling toggle, bundle offer settings, offers-enabled toggle, and creating a listing (already gated - will be routed through the same check for consistency).

## 6. Offers screen restructure

Two stacked toggles:

```text
[ 🛍️ Buyer | 🏷️ Seller ]
[ 📥 Received | 📤 Sent ]
```

Contents by combination:

- Buyer / Received - seller discount offers sent to you (on items you liked or have in cart).
- Buyer / Sent - offers you made on other people's listings.
- Seller / Received - buyer offers on your listings.
- Seller / Sent - discount offers you sent to people who liked or carted your items.

The underlying data already distinguishes these four cases by direction and by whether you are the buyer or seller; the screen will filter on both instead of only "received vs sent". Empty states and counts update per combination, and the Offers badge keeps counting only actionable incoming offers.

## 7. Reviews filter

Reviews are currently tagged with the role of the person who *wrote* them, so a review written by a buyer about @sarahhearn2 as a seller lands under "Buyer". Flip the categorisation to the role of the person being reviewed: a review of you as the seller of that order shows under Seller, a review of you as the buyer shows under Buyer. "All" keeps everything. Reviews whose order can't be loaded will fall back into "All" only.

## 8. Order success animation

The success screen auto-navigates to the orders list on a timer. Remove that timer so the animation stays until the user taps close or the back gesture.

## 9. Order and sales financial breakdown

Add a consistent breakdown block to the buyer order details sheet and the seller sale details sheet:

- Item price (per item for bundles)
- Bundle / item discount
- Coupon code applied and its value
- Accepted offer adjustment
- Shipping
- Buyer fees (buyer view) or transaction fee (seller view)
- Final "You paid" / "You received"

Values come from the stored order record so historical orders stay accurate.

## 10. Offer notification audit

Confirmed issue: when open offers are voided, the seller gets "😔 Open offers on X were cancelled - the item is no longer available", including when the seller's own action caused it. Changes:

- Rewrite the seller-facing text so it reads as a seller update, not a buyer one.
- Don't notify the user who triggered the change.
- Sweep every offer notification (created, accepted, declined, withdrawn, replaced, expiring, expired, voided) and confirm each one is addressed to the right side with role-correct wording and a trailing full stop.

## Technical notes

- Database migration: adjust `listings_update_guard`, `profiles_update_guard` and the comment guard so `process_report` can increment counters; rewrite `notify_offers_voided` for role-correct recipients and copy.
- Frontend: `src/pages/SellerProfile.tsx` (header + username lookup), `src/components/ListingComments.tsx`, `src/pages/Offers.tsx` + `src/hooks/useOffers.ts` (four-way split), `src/components/ReviewsDrawer.tsx` + `src/hooks/useReviews.ts` (reviewed-role), `src/pages/CheckoutSuccess.tsx` (drop auto-navigate), `src/components/OrderDetailsSheet.tsx` and `src/components/SalesDetailsSheet.tsx` (breakdown), plus a shared seller-setup gate hook used by Sales, Offers, Settings toggles and the Seller Dashboard.

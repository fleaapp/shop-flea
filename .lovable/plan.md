I re-checked the real code and database for every item from the last audit before writing this, so the status below is verified, not from memory. Then I've laid out everything still outstanding as a fresh, prioritised audit in plain language.

## Part 1 — What's already fixed (verified)

**Security holes closed**
- The three unprotected back-end endpoints are locked down. Resetting a seller now requires a verified admin; recovering an order requires the actual buyer or an admin; payouts no longer trust an unverified login token.
- 17 back-end functions now require a valid login. Only genuinely public ones (payment webhook, email hook) stay open.

**Money correctness**
- Payouts carry a unique fingerprint, so a double tap or retry can't send the money twice.
- The 1.5% instant payout fee now actually reaches Flea. If it can't be collected, the payout stops with a clear message instead of quietly shortchanging the seller.

**Policy and copy truth**
- Checkout no longer names the payment provider brand.
- The fee popover now correctly states the seller's 2% + $0.50 transaction fee instead of "no selling fees".
- The server refund window matches the published 48h + 72h policy.
- FAQ now agrees with Terms on dispatch deadlines, on listings being blocked until verification, and on the 7-year record-keeping requirement.
- Terms and Privacy now cover GST on Flea's fees, chargeback double-dipping, 18+ selling age, and camera permissions.

**Other**
- Screen-reader labels on the header and bottom navigation.
- Logout confirmation dialog.
- The 72-hour auto-approval job is confirmed running hourly in the database, alongside auto-refund-unshipped and order-progress jobs.

## Part 2 — Critical, still outstanding

**1. Coupon fees aren't saved onto the order (biggest one)**
When someone uses FREEFLEA, the waiver isn't recorded. Receipts, order details and refunds all recalculate 4% + $0.70 as if the coupon never existed.
- *User impact:* the total shown doesn't match their bank statement — the fastest way to lose trust.
- *Business impact:* refunds pay back fees Flea never collected. Real money out the door.
- *Fix:* save the actual fee charged, the coupon code and its type onto every order line at checkout; make receipts, order screens and the refund calculator read that saved number instead of recalculating. Add a safeguard so two simultaneous checkouts can't create duplicate order rows.
- *Size:* Medium.

**2. No way to report a lost parcel**
Refunds are only offered once an order says "delivered". If a parcel never arrives, the buyer has no route in the app.
- *Fix:* allow a refund request from "shipped" after a set number of quiet days, in both the order screen and the server rule. Add a "where is my parcel" state.
- *Size:* Medium.

## Part 3 — High priority

- **Back button on deep links** — Listing Details, Checkout and Create Listing still use the raw back action, which can drop people on a blank screen when they arrive from a push notification or shared link. A safe helper already exists; switch these over. *Small.*
- **Buyer self-declared delivery** — the admin review queue exists, but the order screen still shows an older "admin marked delivered" branch. Confirm a buyer's own "delivered" tap routes into review rather than releasing funds instantly. *Medium.*
- **Possible duplicate "Order Shipped" push** — both the database and the app send it. Pick one sender and add a dedupe key. *Small.*
- **Heavy list queries** — favourites, reviews and wishlist fetch every column with no page limit; the admin threads screen makes two database calls per thread. Add column lists, pagination and one batched admin query. *Medium.*
- **Wildcard CORS and no rate limits** on money-moving and admin functions; the ID upload function decodes the whole file before checking its size limit and never checks the file is actually an image. *Medium.*

## Part 4 — Medium priority

**Orders and refunds**
- A group of items shows one combined status, so a partial refund can be invisible.
- Tracking numbers are checked for existence only — nonsense is accepted.
- A failed partial refund leaves items in limbo behind a generic error message.
- The bundle discount label disappears silently when no percentage is set.
- Receipts read the seller's *current* shipping settings rather than the settings at purchase time.

**Notifications**
- Opening the Alerts tab marks everything read, even items the user never scrolled to.
- Two notification types (final shipping warning, overdue for buyer) have no in-app wording, emoji or tap destination.
- The "delivered" push goes to the buyer instead of the seller.
- Cart calculates its badge separately from the shared badge system, so numbers can disagree.

**UI and consistency**
- Around 20 files hardcode colours instead of using the design system, which is why some screens drift visually.
- Listing Details has two equal-weight buttons with no obvious primary action.
- Empty, loading and error states are inconsistent — no list screen has a proper "something went wrong, retry" state.
- Contact Support uses tappable plain boxes rather than real buttons.
- Several icon buttons are smaller than the 44px minimum tap size (Profile, Wishlist, Comments, Coupon input).
- Home and Cart have no main page heading.
- Password rules are shown one error toast at a time instead of all at once.

**Privacy**
- Public profiles expose an exact last-active timestamp; the listings image bucket allows the full file list to be enumerated.

## Part 5 — Feature gaps vs Depop / Vinted / eBay

Flea is at or above the standard on buyer protection, bundle shipping and the swipe feed. It's behind on:
- **Offers / make-an-offer** — absent entirely, and expected on Depop and Vinted.
- **In-transit dispute handling** — covered by item 2 above.
- **Seller analytics** — views, saves, conversion.
- **Buyer "where is my parcel" tracking view** — currently just a status word.
- **Prohibited items FAQ** and a named external dispute pathway.

## Overall health score

**79/100** — up from 68. The release-blocking security holes and the payout money leak are fixed, and the policy copy now tells the truth. The remaining blocker is the coupon fee snapshot: until totals are saved rather than recalculated, some buyers will see a figure that doesn't match their bank.

## Suggested build order

1. Coupon fee snapshot (Critical #1) — money correctness first.
2. Lost parcel path + delivery review gate (Critical #2, High #2) — same part of the order lifecycle.
3. Quick wins: safe back button, duplicate shipped push.
4. Query performance, CORS and rate limits, upload validation.
5. Medium UI, notification and consistency sweep.
6. Feature gaps — offers first, then seller analytics.

## Technical detail

Fee source of truth moves to the `orders` table rather than `feeCalculator`. Add `secure_checkout_fee`, `coupon_type`, and per-line `transaction_fee` (today only the first row of a group carries it), plus a unique index on `orders(checkout_reference, listing_id)` to close the finalize-checkout race. Use largest-remainder allocation for pro-rata shares so repeated partial refunds sum exactly to the original charge.

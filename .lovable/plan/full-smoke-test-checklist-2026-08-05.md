# Full smoke test checklist

End-to-end scenarios covering every major feature. Run on native iOS (source of truth) and web. Use two accounts: Buyer (B) and Seller (S), plus an Admin account (A).

## 1. Auth and account
- Sign up with email + password, receive verification email, confirm, land in app.
- Sign up attempt with an email that already exists - duplicate account prompt appears, no second account created.
- Sign in with email, with username (case-insensitive, with and without `@` prefix).
- Google sign-in (web only - blocked on iOS runtime with a clear message).
- Apple sign-in on native.
- OAuth account that already exists as email/password - provider conflict dialog appears and resolves.
- OAuth first-time user - forced password setup before tutorial unlocks.
- Forgot password - email arrives, `/reset-password` sets a new password, sign in with it.
- Logout - navigates to /auth, session cleared, no blank screen.
- Browse as Guest - wishlist and discards persist locally, merge into the account on sign-in.
- Account deletion - blocked while active orders exist, otherwise 14-day cooldown starts.
- Blocked/banned user - cannot sign in or list; listings auto-archived.
- Region lock - non-AU location falls back to AU; waitlist capture works.

## 2. Onboarding
- First-run splash video plays and fades.
- Tutorial carousel: all slides, gesture cards, completion flag persists.
- Seller onboarding sheet steps 1-5 with correct copy; exit the app mid-flow and return - progress resumes at the same step.
- ID verification: front and back required for AU driver licence, live capture, success and failure states.
- Post-onboarding native confirmation of verification status.
- "Action required" state on the Set up seller button when Stripe needs more info.
- Cannot create a listing until verified.

## 3. Listings
- Create listing: images cropped to 4:5, category > subcategory, brand match, size, condition, colour, style, gender, tags, price, shipping price.
- Bundle offers button (full width, chevron) opens bundle settings and saves.
- Offers toggle row; auto-accept price field appears/disappears with it.
- Edit listing - all fields persist; images reorder and delete without clipping.
- Pause selling - ⏸️ state on cards and detail.
- Delete listing - ⛔️ removed-item state persists in wishlist/cart snapshots.
- Listing detail: price breakdown drawer, ✈️ shipping format `+$X shipping`, seller bubble, last-active, listing age.
- Sold listing locks: no cart add, no offers, red SOLD sticker.

## 4. Browse, search, wishlist, cart
- Home feed swipe: like, skip (⏭️ moves card to bottom), discard persistence.
- Search: text query, trending searches refresh on sheet open, saved searches + match notifications.
- Filters: multi-select category/size/brand/condition/colour, clear all.
- Wishlist grid and list modes; engagement badges (cart/wishlist counts, 99+ cap).
- Cart: add, swipe-to-remove with confirm dialog, bundle shipping totals, multi-seller grouping.

## 5. Offers
- Buyer makes an offer; seller receives notification and it deep-links to the correct Offers tab.
- Seller counters, buyer counters, accept, decline, withdraw - each fires the right notification copy.
- Auto-accept rule triggers instantly at or above the threshold.
- Blast offer to wishlist/cart users; 24h rate limit per listing enforced.
- Offer floor rules: min $3, min 60% of asking price, must be below asking price.
- Accepted offer applies its price in cart for 24h, then expires and reverts.
- Offers disabled by seller closes pending offers.
- Non-seller opens the Offers screen and sees the seller setup prompt, not an error.
- Listing sold or edited voids live offers with notification.

## 6. Checkout and coupons
- Single-item checkout: Apple Pay, Google Pay, saved card, new card.
- Multi-item bundle from one seller: combined shipping, discount line on its own row.
- Multi-seller cart splits into separate orders sharing an order group.
- Fees shown correctly: buyer 4% + $0.70 Secure Checkout Fee; seller 2% + $0.50 transaction fee.
- Coupon `FREEFLEA` removes buyer fees; totals and receipt reflect it; redemption recorded once.
- Invalid/expired/over-limit coupon shows a clear error.
- Address: OpenStreetMap AU-restricted autocomplete, save details toggle, suburb maps to city.
- Payment declines surface a friendly message and leave the cart intact.
- Seller not fully onboarded is blocked at checkout with a clear reason.
- Success screen, order number `FL-00xxxx`, receipt render (zigzag edges, no clipping).

## 7. Orders and shipping
- Buyer Orders tabs: Ordered | Shipped | Delivered, plus refunds toggle.
- Seller marks shipped with AU carrier + tracking; invalid tracking rejected; admin approval path.
- Auto-deliver of shipped orders; auto-complete after the dispute window.
- Overdue banner at 4+ days unshipped.
- 8-day auto-refund for unshipped orders.
- Shipping status tracker visuals; delivery confirmation by buyer.
- Order/sale details summaries: item count `x2` stays on the username line, ordered field order, correct totals.

## 8. Refunds and cancellations
- Buyer requests refund within 10 days of delivery with live camera/video proof only (no gallery upload).
- Seller accepts or declines; decline reason shows to buyer.
- Auto-approval if the seller does not respond in time.
- Seller refunds an unshipped item from Sale details (same grey full-width button and dialog as the buyer flow).
- Multi-item order: select some or all items to refund.
- Relist toggle on cancellation returns the listing to active.
- Refund appears in payout history, buyer alert fires, seller cancel count increments.

## 9. Messaging
- Order chat between buyer and seller: send text, attachment, read receipts, unread badge clears.
- Message send latency acceptable; messages persist after backgrounding the app.
- Support chat thread create + admin reply; unread support badge.
- Listing comments: post, reply, @mention notification, report/delete a comment.
- Keyboard behaviour on native: no black footer, composer visible, footer removed while composing.

## 10. Notifications
- Push permission sheet, subscription registers, iOS re-registers on mount.
- Push received for: offer events, sale, bundle sale (one alert for multi-item), message, comment, mention, review, order status, refund, payment action required.
- Tapping each push and each in-app alert opens the correct screen or drawer.
- Realtime toasts appear while the app is open.
- Bottom nav badges (Alerts, Sales, Cart, Wishlist) match live counts and clear correctly.
- Notification settings screen with push toggle inside.

## 11. Seller dashboard and payouts
- Centre-aligned header, refresh on every open, Sales button matches the profile one.
- Available and pending balances match the itemised list, including the clearing row.
- 1.5% instant payout, hidden until first payment and full verification.
- Settle balance sheet; payouts gated on valid tracking.
- Payout history includes refunds.
- GST threshold alerts at 60k and 75k.

## 12. Profiles and reviews
- Edit profile: avatar crop 1:1, username uniqueness, location, preferences.
- Own username taps route to /profile, not /seller/:id.
- Seller profile tabs 50/50 split, Sold tab counts individual orders.
- Leave a review with photo, 1-5 stars, rating aggregates update, review alert opens the review.

## 13. Admin
- Admin dashboard access gated by role.
- Users, listings, brands, reports, refunds/disputes, transactions, waitlist, contact submissions, suggestions, error logs.
- Order codes in admin transactions match `FL-00xxxx` on the order.
- Mark listings/users as seen clears admin badges.
- Approve/reject tracking and untracked delivery.

## 14. Platform and resilience
- Safe-area headers on notch devices during long sessions.
- Drawers: top-10 offset, footer buttons not clipped, status bar stable on open/close.
- Deep links and back navigation use the safe-back helper - no blank screens.
- Offline / flaky network: retries, no duplicate orders.
- PWA update: new service worker triggers reload; stale chunk recovery.
- Error logging reaches admin error logs with plain-English titles.

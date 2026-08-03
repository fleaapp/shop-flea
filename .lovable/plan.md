# Flea - Full QA Test Checklist

A pre-launch test pass covering every screen, flow and edge case. Test on native iOS first (source of truth), then PWA/web. Use two real accounts (buyer + seller) plus one admin.

## 1. Accounts and auth
- Sign up with email: username taken, invalid email, weak password, existing account detection.
- Sign up / sign in with Google and Apple; same email across providers shows the conflict dialog, not a duplicate account.
- Login with username (case-insensitive, with and without a leading @) and with email.
- Forgot password, reset link, verify email link (check inbox and spam, sender shows as Flea).
- Password setup prompt for OAuth users; tutorial blocked until complete.
- Session persistence: kill and reopen app, background 24h+, expired/rotated token forces a clean sign-out (not a white screen).
- Logout, then guest mode: browsing allowed, gated actions prompt sign-in.
- Account deletion: blocked with active orders, cooldown message correct.

## 2. Onboarding and seller setup
- Seller onboarding steps 1-4 copy, progress saved when the app is backgrounded or force-quit mid-flow.
- ID verification: front and back required for AU licence, camera capture only, retake, upload failure retry.
- No external links or Safari hand-offs at any point.
- "Action required" state on the seller setup button; listing creation blocked until verified.
- Verification result popup after onboarding; balance replaces status once verified.

## 3. Listings
- Create listing: all categories and subcategories save, image crop 4:5, up to max photos, thumbnails, brand autocomplete, price/shipping validation, earnings preview.
- Edit, hide (disappears from profile and feed), pause selling, mark as sold, delete.
- Sold, refunded, paused and removed states never appear as active, and never show Edit to non-owners.
- Refunded items stay terminal - not relisted, not in feed.
- Listing details: created date, price info drawer, tags, seller card, bundle offer badge, report menu, engagement badges (cart/wishlist, 99+ cap).

## 4. Browsing, search, wishlist, cart
- Home swipe stack: like, skip, undo behaviour, feed excludes own/paused/inactive-seller items, infinite scroll.
- Search: text, trending searches, all filters (size, category, gender, condition, colour, style, brand, price range), clearing filters.
- Save a search, saved-search alert arrives within the hour for a matching new listing, no alert for non-matching filters.
- Wishlist add/remove, swipe-to-remove without screen shake, grid and single view.
- Cart: add, remove, bundle grouping per seller, shipping and bundle discounts, sold-out item removed with a message.

## 5. Offers
- Buyer makes an offer, counter-offer rounds, withdraw, decline, accept.
- Seller blast offer reaches wishlist and cart holders; 60% floor enforced.
- Offers toggle off closes open offers.
- Accepted offer price flows into cart and checkout; 24h payment window countdown; expiry reminder 4h before.
- Offers voided when item is sold, deleted, paused or repriced - both sides notified with the correct wording.

## 6. Checkout and payments
- Apple Pay, Google Pay, saved card and new card; amounts match the summary exactly (no 100x errors).
- Fees: buyer 4% + $0.70 secure checkout fee shown clearly; discount and free shipping on their own lines.
- Coupon FREEFLEA removes buyer fees and recalculates the total correctly.
- Multi-seller cart splits into correct orders; bundle discount applied once per seller.
- Failure paths: declined card, cancelled sheet, network drop mid-payment, double-tap on Pay, backgrounding during payment. No orphan charges, no duplicate orders.
- Address entry and saved details, AU-only address lookup.
- Success screen, receipt, order appears for both parties.

## 7. Orders, shipping, refunds
- Buyer: order list tabs (ordered / shipped / delivered / refunds), order details drawer, tracking link, mark as delivered.
- Seller: sales list, add tracking (AU carriers only), invalid tracking rejection, overdue banner at 4+ days.
- 8-day auto-refund for unshipped orders fires and notifies both sides.
- Refund request within 10 days of delivery with live camera photo/video only; seller accept/decline; 72h auto-approval; admin dispute queue.
- Funds release 48h after delivery; held/pending/available balances add up on the seller dashboard.
- Payout history shows payouts and refunds; 1.5% instant payout; negative balance settlement.

## 8. Messaging and notifications
- Order chat both directions, attachments, send speed, read receipts clearing badges.
- Support chat threads.
- Comments and @mentions on listings, speed and notifications.
- Push notifications: correct account only, tapping opens the right screen or drawer (order, sale, offer, review, listing).
- Bell alerts: no duplicates, marked read on open, badges clear and never flash when switching tabs.
- Notification settings screen: push toggle, marketing emails toggle, permission denied path.

## 9. Reviews and profiles
- Leave a review as buyer and as seller, photo attachment, rating updates seller average.
- Review notification opens the review.
- Own profile vs seller profile: tabs, counts, grid/single view, star rating and last-active bubbles, bundle offer banner.
- Report user and report listing; strike handling.

## 10. Admin
- Access denied for non-admins on every /admin route.
- Users (signup and last active), listings, brands, transactions, refunds/disputes, approvals queue, error logs in plain English, mark-as-seen clears badges.

## 11. Device, layout and resilience
- Safe area: no notch clipping, no lime bleed on scroll, status bar correct when drawers open and close.
- Keyboard: no black background, inputs never hidden behind the keyboard, auth screen stays put on focus.
- Drawer footers not cut off; 44px touch targets.
- Offline banner, airplane-mode recovery, slow 3G, app resumes on the same screen after backgrounding.
- Fresh install, app update with stale JS chunk (auto-reload), PWA install and reload.
- Copy check: short dashes only, no "Stripe" in user-facing text, trailing full stops on notifications, ✈️/📦 emoji usage consistent.

## Priority order
1. Checkout and payments, 2. Offers to purchase, 3. Refunds and payouts, 4. Notifications, 5. Listing lifecycle, 6. Everything else.

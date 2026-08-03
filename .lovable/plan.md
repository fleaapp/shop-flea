# Flea - Full QA Test Checklist

Every line is one test case. Mark pass/fail. Test on native iOS first (source of truth), then web/PWA.

## 1. Account & Auth
1. Sign up with email + password, receive verify email, land in inbox not spam, sender shows "Flea".
2. Sign up with an email that already exists - blocked with clear message, no duplicate account.
3. Sign up with a username already taken - blocked before submit.
4. Username login with and without leading @, mixed case.
5. Login with wrong password - clear error, no lockout confusion.
6. Forgot password - request email, open link, land on reset screen (not auto-logged-in), set new password, login with new password.
7. Forgot password with an email that has no account - generic message, no account enumeration.
8. Forgot password link used twice / after expiry - clear error.
9. Google sign-in on native (new user) - profile created, username setup prompted.
10. Google sign-in on an email that already has a password account - provider conflict dialog appears and resolves.
11. Apple/Google sign-in cancelled midway - returns cleanly, no stuck spinner.
12. Change email in settings - verification sent to new address, old address still works until confirmed.
13. Change password while logged in.
14. Logout - lands on /auth, no protected data cached, back button doesn't restore session.
15. Session expiry / JWT rotation - user is signed out gracefully, not stuck on blank screen.
16. Account deletion blocked when active orders exist; allowed otherwise, with cooldown.
17. Paused selling toggle on/off persists after app restart.
18. Blocked/inactive user - listings auto-archived, cannot list or buy.
19. Non-AU location - regional lockdown behaviour.
20. Onboarding tutorial completes; force-quit mid-tutorial resumes at same slide.

## 2. Profile & Social
21. Edit profile: avatar crop/upload, bio, username change, save persists after reload.
22. Avatar fallback renders for users with no image.
23. Tapping own username anywhere routes to /profile, not /seller/:id.
24. Seller profile: star rating bubble, review count, last-active bubble, bundle offer badge.
25. Follow/unfollow, follower counts update.
26. Block a user - their listings and messages disappear both ways.
27. Report a user and report a listing - admin sees the report.
28. Comment on a listing, @mention another user - both seller and mentioned user get notified.
29. Delete own comment; cannot delete others'.

## 3. Listings
30. Create listing: all required fields, 4:5 crop on every image, multi-image reorder and delete.
31. Create listing blocked when seller not verified - "action required" path shown.
32. Every category and subcategory combination saves without constraint error.
33. Sizes render with AU prefix in detail, uppercase no prefix on cards.
34. Multi-select tags (condition, colour, style) split into individual bubbles.
35. Brand matching: valid brand, unknown brand, 1-char input.
36. Shipping price shows as 📦 +$X on cards and +$X shipping in detail.
37. Bundle Offers configured in shipping settings; badge shows on profile and listing.
38. Edit listing - price change voids existing offers and notifies offerers.
39. Hide listing - removed from own profile and all feeds; unhide restores.
40. Pause listing - ⏸️ state, not purchasable.
41. Mark as sold manually (sold elsewhere) - listing terminal, no errors.
42. Delete listing with no orders - succeeds. With an active order - blocked with clear reason.
43. Refunded listing does not reappear as active or sold twice.
44. Listing detail: created date/time, price info ⓘ drawer, engagement badges (cart/wishlist counts, 99+ cap).
45. Report listing from 3-dot menu.

## 4. Discovery
46. Home swipe stack: like, skip (moves to bottom), wishlist, no visual jump on swipe.
47. Feed excludes own listings, blocked users, inactive sellers, sold/paused/refunded items.
48. Search by keyword, by brand, empty-result state.
49. Trending searches populate and refresh when sheet opens.
50. Filters: category, subcategory, size, condition, price range, colour, style - combined and cleared.
51. Save a search; hourly match notification fires for a new matching listing.
52. Wishlist add/remove; swipe-to-remove without screen shake; grid and list view modes.
53. Wishlist item that sells shows sold overlay; deleted item shows ⛔️ with cached details.

## 5. Offers
54. Buyer makes an offer; seller gets notification with correct name, amount, item.
55. Offer below 60% floor rejected with clear message.
56. Seller accepts - buyer notified "you have 24 hours to pay", price updates in cart and checkout immediately.
57. Seller declines - buyer notified.
58. Seller counters - buyer notified, can accept/decline/counter back.
59. Buyer withdraws offer - seller notified.
60. New offer supersedes previous - old one marked declined, "Offer replaced" notification.
61. Offer expires at 24h - both parties notified, cart price reverts.
62. Accepted-offer payment window expires - reminder notification then void.
63. Seller blast offer to all users with item in wishlist AND cart.
64. Blast offer to a user who already has a pending offer - handled, correct toast.
65. Blast offer when nobody has it saved - correct toast.
66. Offers toggle off on profile hides 💰 Offer button.
67. Offers page: pending/accepted/expired tabs, countdowns tick correctly.
68. Offer voided by listing being sold/hidden/paused - user notified.

## 6. Cart & Checkout
69. Add multiple items from the same seller - bundle shipping applied once, discount line shown separately.
70. Add items from multiple sellers - grouped correctly, shipping per seller.
71. Cart item sells to someone else while in cart - removed with a message.
72. Fee line: 4% + $0.70 buyer fee displayed; ⓘ popover copy correct (no seller-fee sentence, no cancellation block).
73. Coupon FREEFLEA removes buyer fees; total recalculates on cart and checkout.
74. Invalid/expired coupon - clear error, total unchanged.
75. Coupon applied then removed - fees restored.
76. Order with offer price only.
77. Order with offer price + coupon - both discounts apply once, order total matches charge.
78. Order with bundle + offer + coupon together.
79. Checkout with Apple Pay - correct amount (not 100x), sheet loads promptly.
80. Checkout with saved card; with new card; with save-card checkbox on and off.
81. Card declined - friendly message, cart preserved, no order created.
82. 3DS/authentication challenge path.
83. Network drop mid-payment - no duplicate charge, no orphan order.
84. Backgrounding the app during the payment sheet then returning.
85. Address entry: AU-only autocomplete, suburb maps to shipping city, save-details persists.
86. Buying own listing blocked.
87. Buying from a seller who is not payout-eligible.
88. Successful order - confirmation, cart cleared, seller notified once (no duplicate sale alerts).

## 7. Orders (Buyer)
89. Order appears under Ordered; segments Ordered / Shipped / Delivered.
90. Seller ships with valid AU tracking - buyer notified, status moves.
91. Invalid tracking number rejected.
92. Mark as delivered manually.
93. Order 4+ days unshipped groups as Overdue with banner.
94. No shipment by 8 days - automatic refund fires, both parties notified, listing set to refunded.
95. Request refund within 10 days of delivery - live camera photo/video required, upload from gallery blocked.
96. Refund request with coupon-discounted order - refund amount equals what buyer actually paid.
97. Refund request on a non-coupon order - full amount incl. fees per policy.
98. Partial/bundle refund - only affected item refunded, single consolidated notification.
99. Refund auto-approved after 72h of seller inaction.
100. Refund declined by seller - dispute path to admin.
101. Order receipt renders and downloads with correct totals.

## 8. Orders (Seller) & Payouts
102. Sale appears in Sales with cost/total bubble, no date stamps.
103. Sale details drawer opens from card and from notification; order summary totals correct.
104. Seller net = price - 2% - $0.50, matches dashboard and Stripe.
105. Refunded sale shows refunded state, not payable.
106. Seller dashboard math: available, pending, in-progress, negative balance after refund.
107. Payout blocked until tracking entered.
108. Funds release 48 hours after delivery (buyer protection window).
109. Instant payout 1.5% fee, only after first payment and full verification.
110. Payout history shows payouts and refunds.
111. Settle negative balance sheet works.
112. Bank details missing - banner shown, payout blocked.
113. Seller dashboard refreshes on every open.

## 9. Seller Onboarding & Verification
114. Set up seller from settings and from the listing gate - same 4-step in-app flow.
115. No external browser or deep link at any step.
116. Exit the app mid-onboarding and return - resumes at the same step.
117. Onboarding step copy correct: step 1 states listing on Flea is free; step 4 has no bank-debit refund mention.
118. Successful completion - native confirmation of verification status.
119. Verification pending - "Pending review 🔍" state, listing still gated.
120. Verification fails / more info required - "Action required ⚠️" on the Set up seller button.
121. ID verification: AU driver licence requires both front and back; passport single image.
122. ID upload from live capture; rejected document re-upload path.
123. Verified seller - balance shown where status pill used to be, no status pills remaining.
124. Payment action required alert rate-limited to once per 24h.

## 10. Messaging
125. Buyer messages seller from order; thread opens from card and from notification.
126. Message send latency acceptable; optimistic message never duplicates.
127. Send failure - retry path, no lost message.
128. Attachments/photos in order chat.
129. Unread badge clears on read and stays cleared after app restart.
130. Push notification for a new message opens the correct thread.
131. Messages hidden after a user is blocked.

## 11. Reviews
132. Leave a buyer review and a seller review after delivery; ratings aggregate correctly.
133. Review with cropped 1:1 photo.
134. Cannot review twice for the same order.
135. Review notification opens the reviews drawer at that review.

## 12. Notifications
136. Push permission sheet appears once; native prompt fires; declining handled.
137. Push token exclusivity - logging in as a different account never delivers the previous user's alerts.
138. Bell notifications mark read; badge counts match unread rows.
139. Footer badges (Alerts, Sales, Cart) show live counts, no flashing when switching screens.
140. Sales badge = awaiting-shipment orders + unread seller messages.
141. Every notification type has correct role-aware copy, bold @username, trailing full stop, no "New notification".
142. Each notification type routes to the correct screen or drawer (order, sale, offer, review, comment, saved search).
143. Push received while app is closed opens the right screen on tap.

## 13. Admin
144. Non-admin cannot reach /admin.
145. Brand management: add, edit, remove.
146. Users: signup time, last active, block/unblock, mark as seen clears badge.
147. Reports: mark handled/resolved.
148. Refunds/disputes queue: approve, decline, manual release.
149. Approvals queue for held payouts.
150. Error logs: plain-English messages, grouping, severity, filtering.
151. Admin badges do not flicker or persist after clearing.

## 14. Layout, Native & Resilience
152. Status bar area live and correctly coloured on every screen, including while drawers open.
153. No content clipped by the notch mid-session or after backgrounding.
154. Keyboard: no black background, inputs lift above the keyboard, no lime bleed at the footer.
155. Auth screen: logo position stable, text boxes do not disappear or jump on focus.
156. Every drawer footer button fully visible above the home indicator.
157. All screens scroll internally, none sit too high or too low.
158. Offline banner appears and recovers.
159. Stale JS chunk after deploy triggers auto-reload instead of a white screen.
160. App returns to the same screen after being backgrounded and reopened.
161. PWA install and launch without white screen.
162. Slow 3G: skeleton loaders on profile, dashboard and feeds, no infinite spinners.
163. Copy audit: short dashes only, no em dashes, no mention of Stripe, no "7%" fee anywhere.

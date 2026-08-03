# Flea - QA Test Checklist (one item per line)

Test on native iOS first, then PWA/web. Use a buyer account, a seller account and an admin account.

## Auth
1. Sign up with email and password.
2. Sign up with a username that is already taken.
3. Sign up with an invalid email format.
4. Sign up with a weak password.
5. Sign up with an email that already has an account.
6. Sign up with Google.
7. Sign up with Apple.
8. Sign in with the same email on a different provider (conflict dialog appears).
9. Sign in with username, lowercase.
10. Sign in with username, uppercase.
11. Sign in with username using a leading @.
12. Sign in with email.
13. Sign in with a wrong password.
14. Forgot password request email.
15. Reset password from the emailed link.
16. Verify email from the emailed link.
17. Check verification email is not in spam and sender reads Flea.
18. Password setup prompt for a new OAuth user.
19. Tutorial blocked until password setup is complete.
20. Close and reopen the app - still signed in.
21. Leave the app backgrounded overnight - still signed in.
22. Expired or rotated token signs the user out cleanly (no white screen).
23. Log out.
24. Browse as a guest.
25. Guest taps a gated action and is prompted to sign in.
26. Delete account with an active order (blocked).
27. Delete account with no active orders (cooldown message shown).

## Seller onboarding
28. Seller onboarding step 1 copy and Continue.
29. Step 2 copy and Continue.
30. Step 3 copy and Continue.
31. Step 4 copy and Finish.
32. Force-quit mid-onboarding and reopen - progress restored.
33. ID verification front photo capture.
34. ID verification back photo required for AU licence.
35. Retake an ID photo.
36. ID upload failure and retry.
37. No step opens Safari or an external link.
38. "Action required" shows on the seller setup button when more info is needed.
39. Listing creation blocked until verified.
40. Verification result popup after onboarding.
41. Balance replaces the status area once verified.
42. Bank details missing banner on the seller dashboard.

## Listings
43. Create a listing in each category.
44. Create a listing in each subcategory.
45. Crop images to 4:5.
46. Add the maximum number of photos.
47. Remove a photo from the preview strip.
48. Brand autocomplete and free-text brand.
49. Price validation (zero, negative, very large).
50. Shipping price validation.
51. Earnings preview matches the fee rules.
52. Edit an existing listing.
53. Hide a listing (gone from profile and feed).
54. Pause selling (all listings hidden, ⏸️ state).
55. Mark a listing as sold.
56. Delete a listing.
57. Delete blocked for a listing with an active order.
58. Refunded listing stays terminal and does not return to the feed.
59. Sold, refunded and removed cards show the right overlay.
60. Edit button never shows on someone else's card.
61. Listing details: created date and time.
62. Listing details: price info drawer.
63. Listing details: tags and size/condition/brand bubbles.
64. Listing details: seller card and bundle offer badge.
65. Listing details: report listing from the menu.
66. Engagement badges show cart and wishlist counts.
67. Engagement badges cap at 99+.

## Browse, search, wishlist, cart
68. Home swipe: like a card.
69. Home swipe: skip a card (moves to bottom).
70. Feed excludes your own, paused and inactive-seller items.
71. Feed loads more on scroll.
72. Search by text.
73. Tap a trending search.
74. Filter by size.
75. Filter by category and subcategory.
76. Filter by gender.
77. Filter by condition.
78. Filter by colour.
79. Filter by style.
80. Filter by brand.
81. Filter by price range.
82. Clear all filters.
83. Save a search.
84. Saved-search alert arrives for a matching new listing.
85. No saved-search alert for a non-matching listing.
86. Add to wishlist and remove from wishlist.
87. Swipe-to-remove on wishlist (no screen shake).
88. Wishlist grid view and single view.
89. Add to cart and remove from cart.
90. Cart groups items by seller with bundle pricing.
91. Sold-out item is removed from cart with a message.

## Offers
92. Buyer makes an offer.
93. Seller counters the offer.
94. Buyer counters back.
95. Buyer withdraws an offer.
96. Seller declines an offer.
97. Seller accepts an offer.
98. Seller sends a blast offer to wishlist and cart holders.
99. Blast offer below the 60% floor is rejected.
100. Turning offers off closes open offers.
101. Accepted offer price shows in cart.
102. Accepted offer price shows at checkout.
103. 24h payment countdown displays and expires.
104. Offer-expiring reminder arrives 4 hours before expiry.
105. Offer voided when the item sells - both sides notified.
106. Offer voided when the item is deleted or paused.
107. Offer voided when the price changes.

## Checkout and payments
108. Pay with Apple Pay.
109. Pay with Google Pay.
110. Pay with a saved card.
111. Pay with a new card and save it.
112. Amount in the payment sheet matches the summary exactly.
113. Buyer fee 4% + $0.70 shown clearly.
114. Discount shown on its own line.
115. Free shipping shown on its own line.
116. Apply coupon FREEFLEA - buyer fees removed and total recalculated.
117. Apply an invalid or expired coupon.
118. Multi-seller cart splits into separate orders.
119. Declined card message.
120. Cancel the payment sheet.
121. Lose network mid-payment.
122. Double-tap Pay (no duplicate order or charge).
123. Background the app during payment.
124. Enter a new shipping address (AU lookup only).
125. Use saved shipping details.
126. Success screen and receipt.
127. Order appears for both buyer and seller.

## Orders, shipping, refunds
128. Buyer order tabs: ordered, shipped, delivered, refunds.
129. Buyer order details drawer and tracking.
130. Buyer marks an order as delivered.
131. Seller adds tracking with a valid AU carrier.
132. Seller enters invalid tracking (rejected).
133. Overdue banner at 4+ days unshipped.
134. 8-day auto-refund fires and notifies both sides.
135. Buyer requests a refund with live photo.
136. Buyer requests a refund with live video.
137. Upload-from-library is not offered.
138. Seller accepts a refund request.
139. Seller declines a refund request.
140. 72h auto-approval of an unanswered refund request.
141. Admin resolves a dispute.
142. Funds release 48h after delivery.
143. Held, pending and available balances add up correctly.
144. Payout history shows payouts and refunds.
145. Instant payout at 1.5%.
146. Negative balance settlement flow.

## Messaging and notifications
147. Buyer sends an order message.
148. Seller replies to an order message.
149. Send an attachment in order chat.
150. Message send speed feels instant.
151. Opening a thread clears its unread badge and it stays cleared.
152. Support chat thread create and reply.
153. Comment on a listing.
154. @mention a user in a comment.
155. Push notification goes only to the signed-in account.
156. Push tap opens the order details drawer.
157. Push tap opens the sale details drawer.
158. Push tap opens offers.
159. Push tap opens the review.
160. Push tap opens the listing.
161. No duplicate bell alerts.
162. Bell badge clears on read and does not flash when switching tabs.
163. Push toggle in notification settings.
164. Marketing emails toggle.
165. Denying push permission at OS level is handled.

## Reviews and profiles
166. Buyer reviews a seller.
167. Seller reviews a buyer.
168. Attach a photo to a review.
169. Seller average rating and review count update.
170. Own profile tabs and counts.
171. Seller profile star rating and last-active bubbles.
172. Bundle offer banner on seller profile.
173. Tapping your own username goes to /profile, not /seller/:id.
174. Report a user.

## Admin
175. Non-admin blocked from every /admin route.
176. Admin users list with signup and last-active times.
177. Admin listings management.
178. Admin brands management.
179. Admin transactions.
180. Admin refunds and disputes.
181. Admin approvals queue.
182. Admin error logs in plain English.
183. Mark-as-seen clears admin badges.

## Device, layout, resilience
184. No notch clipping on any screen.
185. No lime bleed when scrolling.
186. Status bar correct when drawers open and close.
187. Keyboard has no black background.
188. Inputs are never hidden behind the keyboard.
189. Auth screen does not jump on input focus.
190. Drawer footer buttons fully visible.
191. Touch targets at least 44px.
192. Offline banner appears and recovers.
193. Slow 3G loading states and skeletons.
194. App resumes on the same screen after backgrounding.
195. Fresh install first run.
196. App update with a stale JS chunk auto-reloads.
197. PWA install and reload.
198. Copy uses short dashes only.
199. No mention of Stripe in user-facing text.
200. Notification copy ends with a full stop and uses the right emoji.

## Priority order
Checkout and payments, then offers to purchase, refunds and payouts, notifications, listing lifecycle, then everything else.

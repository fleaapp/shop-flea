Careful review of every FAQ in `src/components/FAQSection.tsx`. Only three swipe directions exist (left = pass, right = Wishlist, up = Cart). Swipe down is disabled — no skip.

## Changes

**🛍️ Buying**
- **How do I buy an item?** — Rewrite: swipe right = Wishlist, swipe left = pass, swipe up = add to Cart. Tap the card for details. No mention of skip / swipe down.
- **Where do I find my Wishlist?** — Fix: tap the **Cart icon in the top right** of the home screen; the Wishlist tab lives inside the Cart screen (not the bottom nav).
- **How do I remove an item from my Cart?** — Keep as-is (left = remove back to stack, right = move to Wishlist). Accurate.
- **How do I pay for my order?** — Keep.
- **What fees do I pay as a buyer?** — Keep (4% + $0.70 Secure Checkout Fee).
- **Can I get a refund?** — Keep.
- **How do I confirm I've received an order?** — Keep.
- **How do I message a seller?** — Keep.
- **ADD: How does swiping work?** — Swipe right ❤️ = Wishlist, swipe left ⛔ = pass, swipe up 🛒 = add to Cart, or tap the card to view full details.

**👕 Selling**
- **How do I list an item for sale?** — Keep.
- **What fees do I pay as a seller?** — Keep (no selling fees).
- **How do I get paid?** — Change "within 48 hours" → **within 24 hours**. Keep first-payout 7-day verification note and 1.5% Instant Payout.
- **What does "Pause Selling" do?** — Keep.
- **How long do I have to ship an order?** — Keep (3-day reminder, 6-day urgent, 4+ days overdue).
- **How do reviews work?** — Keep.
- **What does the ⏸️ on my listing mean?** — Keep.
- **Can I mark an item as sold elsewhere?** — Keep.

**🔍 Browsing & Filters**
- **How do I filter listings?** — Keep.
- **What if I want an item I passed on?** — Keep (undo button top right + Refresh Passed Listings in Settings).
- **Can I search for specific items?** — Keep.
- **REMOVE: Why do I only see Australian listings?**

**📦 Shipping** — All three kept as-is.

**💳 Payments** — All four kept as-is (payment provider wording, verifying state, pending/action required, dashboard in-app).

**👤 Account & Privacy** — All kept as-is (sign-in incl. Google in-app, Guest Mode, verification email, change email/password, delete account with 14-day cooldown, listings archived on delete, report).

**🔔 Notifications & Alerts** — All three kept as-is.

No other changes. Frontend copy only.
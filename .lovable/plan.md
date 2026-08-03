## Accepted offer pricing and full-flow fix

### Confirmed issue
- The accepted offer is valid in the database: the latest accepted offer is **$4.25** against a **$5.00** listing, remains active for 24 hours, and the item is in the buyer's cart.
- The backend payment and order functions already resolve accepted-offer prices authoritatively.
- The frontend cart only resolves offer prices when `CartContext.fetchCart()` runs. Accepting an offer does not refresh or invalidate the shared cart state, so the existing $5.00 cart item remains cached when the buyer opens Cart or Checkout.
- The cart's accepted-offer RPC currently ignores returned query errors, allowing a failed price lookup to silently display the listing price.

### 1. Make accepted prices update immediately
- Add a shared offer-change invalidation event/query path.
- After accept, auto-accept, counter, decline, withdrawal, and offer creation, refresh accepted offers and the shared cart where the action can affect price or expiry.
- Make Cart and Checkout refresh accepted prices on screen entry, app resume, and offer-change events - not only when the cart provider first mounts.
- Preserve the original listing price separately and apply the accepted price as the displayed and calculated item price.

### 2. Fail safely instead of silently showing the wrong amount
- Handle RPC errors explicitly in `CartContext` and `useAcceptedOffers`.
- When accepted-price resolution fails, block checkout and show a clear retry message rather than displaying or charging an unverified price.
- Keep the payment-intent endpoint as the price authority and return the corrected server total when stale client totals reach checkout.
- Refresh the cart automatically after a checkout amount mismatch, then let the buyer retry with the correct visible total.

### 3. Cover every offer transition
- Buyer offer: create, auto-accept, seller accept, decline, withdraw, expire.
- Seller offer: send to wishlist/cart users, buyer accept, decline, counter, expire.
- Counter-offers: close the prior offer, expose only the current live round, and refresh both participants' offer and cart state.
- Accepted offers: add/retain the item in the buyer's cart, show the locked price and 24-hour countdown, and remove the discount immediately on expiry.
- Sold, removed, refunded, paused, or otherwise unavailable listings: prevent new responses/payment and show a terminal state.

### 4. Keep UI, checkout, and stored orders consistent
- Use the accepted amount in Cart rows, Cart totals, Checkout rows, Checkout totals, payment creation, finalized order price, receipts, refunds, and seller payout calculations.
- Show original price struck through beside the offer price where applicable.
- Ensure the 24-hour reminder and countdown update without requiring an app restart.
- Once payment succeeds, finalize the order at the accepted amount and expire/close competing offers for that listing.

### 5. Verification
- Test buyer-created and seller-created offers, including auto-accept and counters.
- Confirm the price changes immediately in Cart and Checkout without reload.
- Confirm payment creation and finalized `orders.price` use the accepted amount.
- Test expiry, app background/resume, stale checkout state, unavailable listings, duplicate actions, and multi-item carts containing both offer-priced and normal items.
- Check notifications and recipient routing for each transition and confirm no duplicate offer notifications are created.
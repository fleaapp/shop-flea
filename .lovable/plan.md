## What I got wrong the first time

Three corrections after re-reading the code:

1. The 💸 Sales button is not on seller profiles - it sits in the top-right vertical button column on the user's **own** Profile screen (💸 Sales, then ✈️ Bundle Shipping). The 💰 Offers button goes into that column, directly under 💸.
2. Checkout does not accept any client-supplied price. Both `stripe-connect-payment-intent` and `finalize-checkout` read `listings.price` from the database and reject anything else, and `finalize-checkout` recomputes the expected charge from DB prices. An offer price cannot flow through as a cart field - both functions need an explicit, server-verified accepted-offer lookup.
3. `cart_items` has only `user_id`, `listing_id`, `created_at`. There is no price column, so the accepted price has to live on the offer row and be joined in, not stored on the cart item.

# Offers on Flea

## Seller controls
- `offers_enabled` toggle in Settings beside Pause selling. Off for existing sellers, on for new ones.
- When on, Create Listing and Edit Listing show an optional **Auto-accept offers at or above $X** field, constrained to 60-100% of the asking price. Offers at or above it are accepted instantly.
- Turning offers off hides the field and stops new offers; existing pending offers run out their clock.

## Buyer flow
- **💰 Offer** button to the right of the 🛒 cart button on listing details, shown only when the seller has offers on, the listing is active, and the viewer is not the seller.
- Make an Offer drawer: thumbnail, asking price, shipping line, amount input, quick chips (-10% / -15% / -20%), 24-hour expiry note.
- Rules enforced server-side: at least 60% of asking price, never below the $3 minimum listing price, below asking price, max 3 offers per buyer per listing.
- Buyer can withdraw a pending offer.

## Offers screen
- 💰 button in the Profile top-right column under 💸, same 12x12 outlined card styling and badge treatment, routing to `/offers`.
- Two segments, **Received** and **Sent**, using the existing Sales card layout: counterpart, thumbnail, asking vs offered price, seller net after the 2% + $0.50 transaction fee, countdown.
- Received offers get **Accept / Decline / Counter**. A counter cancels the original and creates a linked offer in the other direction, up to 5 rounds.

## Seller discount blasts
- From the seller's own listing detail and the Offers screen: **Send offer to interested buyers**, targeting people with the item in cart or wishlist, capped at 50 recipients and once per listing per 24 hours.
- Each recipient gets a seller-originated offer they can accept or ignore, plus a notification and a discount badge on the item in their cart/wishlist.

## Accepted offer to payment
This is the part that needs real backend work, because price is currently DB-only:
- Accepting adds the listing to the buyer's cart and records `accepted_at` + `expires_at` (24h) on the offer.
- Cart and Checkout join the buyer's accepted offers by listing id and render original price struck through, offer price, and countdown. Checkout button reads **Pay $X - offer price**.
- `stripe-connect-payment-intent` and `finalize-checkout` each gain an authoritative offer lookup: for every listing in the basket, load any accepted, unexpired offer for that buyer and use its amount in place of `listings.price`. The client still sends no prices.
- Every downstream calculation - bundle shipping, coupons, the 4% + $0.70 secure checkout fee, the 2% + $0.50 seller transaction fee, and the $3 minimum check - runs off the resolved price. The order row snapshots both the original and the accepted price, so receipts, refunds and `computeSellerNet` stay correct.
- If the offer expired, was withdrawn, or the listing left `active` between cart and pay, checkout blocks with a clear message and the cart reverts to full price.
- No reservation: first to pay wins, and remaining offers on a sold listing expire.

## Notifications
New types with push plus bell entry, trailing full stop, deep-linked:
- Seller: offer received, buyer countered, offer expiring in 2 hours.
- Buyer: offer accepted (cart CTA), declined, countered, seller discount received, offer expired.

## Edge cases
- Listing sold, paused, hidden, removed or refunded expires all pending offers and hides the Offer button.
- Blocked or deleted accounts void their offers.
- Offers re-validate against the server when the app returns to the foreground.

## Technical details
- New table `public.offers`: `listing_id`, `seller_id`, `buyer_id`, `amount`, `original_price`, `status` (pending / accepted / declined / countered / expired / withdrawn), `direction` (buyer_to_seller / seller_to_buyer), `parent_offer_id`, `expires_at`, `accepted_at`, timestamps. GRANTs to `authenticated` and `service_role`, RLS limiting reads and writes to the buyer and seller on the row, plus a partial unique index blocking duplicate pending offers per buyer/listing.
- New `profiles.offers_enabled boolean`, `listings.auto_accept_offer_price numeric`, and a matching column exposed through `profiles_public` so buyers can see whether a seller takes offers.
- All mutations go through SECURITY DEFINER RPCs (`create_offer`, `respond_to_offer`, `withdraw_offer`) so the 60% floor, $3 floor, 3-offer cap, counter depth and auto-accept run server-side. Status is never set from the client.
- Hourly `pg_cron` job expires offers past `expires_at`.
- Push sent via explicit edge function calls, not database triggers, matching the existing pipeline.
- Frontend: `src/pages/Offers.tsx`, `src/components/MakeOfferDrawer.tsx`, `src/components/OfferCard.tsx`, `src/hooks/useOffers.ts`, plus edits to `ListingDetails.tsx`, `Profile.tsx`, `Settings.tsx`, `CreateListing.tsx`, `EditListing.tsx`, `Cart.tsx`, `Checkout.tsx`, `feeCalculator.ts` and the notification router.

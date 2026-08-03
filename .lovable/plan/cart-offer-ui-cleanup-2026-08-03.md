# Cart Offer UI Cleanup

## Goal
Clean up the cart offer UI so the offer expiry is shown only once, in the light green banner, and the white item card no longer duplicates it.

## Changes

1. **Remove duplicate offer line from cart item card**
   - File: `src/components/CartItemRow.tsx`
   - Remove the `💰 Offer · {offerTimeLeft(...)}` text block under the price.
   - Keep the struck-through original price and the offer price display.

2. **Update the green offer-lock banner copy**
   - File: `src/pages/Cart.tsx`
   - Change the existing `bg-primary/15` banner from:
     - "💰 Offer price locked - earliest expires in ..."
   - To:
     - "💰 Offer expires in {hours}h" (single item)
     - "💰 {n} offers expire in {hours}h" (multiple items)
   - Use the same `offerTimeLeft` helper but format the output so it reads as an expiration countdown rather than "locked".
   - Preserve the existing banner styling (`bg-primary/15 text-center text-xs text-foreground`).

## Out of scope
- No backend or offer logic changes.
- No changes to checkout, listing details, or offers management page.

# Comment mentions, Offers toggle, Sale details cleanup

## 1. Tapping a tagged username says "Seller not found"

Usernames are stored in the database with a leading `@` (e.g. `@jcsbh`). When a mention link opens the seller profile, the route handler strips the `@` from the URL and then looks for a username without it, so nothing matches and the page falls through to the "Seller not found" state.

Fix: in `src/pages/SellerProfile.tsx`, look up the username in a way that matches whether or not the stored value has a leading `@` (try both forms). Keep the existing UUID path unchanged, and keep the "self" redirect to `/profile` working.

Also confirm the link in `src/components/ListingComments.tsx` passes the handle cleanly to the seller route.

## 2. Offers "Received | Sent" toggle styling

`src/pages/Offers.tsx` currently renders the secondary toggle as a bordered outline pill with `bg-muted` on the active item, which does not match Sales/Orders.

Fix: restyle it to match the secondary segmented control used on Sales and Orders - filled `bg-muted` track with `p-1`, active item `bg-card text-foreground shadow-sm`, inactive `text-muted-foreground`, same rounded-full pill and text size. Keep the primary Buyer | Seller toggle and all behaviour unchanged.

## 3. Remove redundant payout copy in Sale details

In `src/components/SalesDetailsSheet.tsx`, remove:
- the "Shipping paid to you" row
- the "Buyer fees and any coupon do not affect your payout." note

The "Items subtotal" row and the rest of the breakdown stay. Order details has no equivalent copy, so nothing changes there (its "Shipping" line is a real buyer charge).

## Technical notes

- Files touched: `src/pages/SellerProfile.tsx`, `src/pages/Offers.tsx`, `src/components/SalesDetailsSheet.tsx`.
- No database or edge function changes.
- Verify with a TypeScript typecheck after the edits.
